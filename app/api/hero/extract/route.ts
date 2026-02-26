import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";

function getCookieFromHeader(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
  }
  return undefined;
}

async function requireSessionFromReq(req: Request): Promise<{ profileId: string } | null> {
  const token = getCookieFromHeader(req.headers.get("cookie"), sessionCookieName());
  if (!token) return null;
  try {
    const s: any = await verifySession(token);
    return { profileId: String(s.profileId) };
  } catch {
    return null;
  }
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function guessMimeFromPath(path: string): string {
  const p = path.toLowerCase();
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

function toDataUrl(mime: string, bytes: Uint8Array) {
  const b64 = Buffer.from(bytes).toString("base64");
  return `data:${mime};base64,${b64}`;
}

// normalize hero key to avoid Murphy vs murphy duplicates
function canonHeroKey(name: string) {
  return name.trim().toLowerCase();
}

export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { upload_id?: string; hint_name?: string | null }
    | null;

  const uploadId = String(body?.upload_id ?? "").trim();
  if (!uploadId || !isUuid(uploadId)) {
    return NextResponse.json({ ok: false, error: "Missing/invalid upload_id (uuid required)" }, { status: 400 });
  }

  const sb: any = supabaseAdmin();

  // Verify upload belongs to profile, and get storage location
  const up = await sb
    .from("player_uploads")
    .select("id, kind, storage_bucket, storage_path, created_at")
    .eq("id", uploadId)
    .eq("profile_id", s.profileId)
    .maybeSingle();

  if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  if (!up.data) return NextResponse.json({ ok: false, error: "Upload not found" }, { status: 404 });

  // Optional: require hero_profile kind
  if (up.data.kind !== "hero_profile") {
    return NextResponse.json({ ok: false, error: `Upload kind must be hero_profile (got ${up.data.kind})` }, { status: 400 });
  }

  const bucket = up.data.storage_bucket || "uploads";
  const path = String(up.data.storage_path || "");
  if (!path) return NextResponse.json({ ok: false, error: "Upload missing storage_path" }, { status: 500 });

  // Download the image bytes via admin storage (no signed url needed)
  const dl = await sb.storage.from(bucket).download(path);
  if (dl.error) return NextResponse.json({ ok: false, error: `Storage download failed: ${dl.error.message}` }, { status: 500 });

  const ab = await dl.data.arrayBuffer();
  const bytes = new Uint8Array(ab);
  const mime = guessMimeFromPath(path);
  const dataUrl = toDataUrl(mime, bytes);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: "OPENAI_API_KEY missing" }, { status: 500 });

  const client = new OpenAI({ apiKey });

  // Keep prompt tight: extract name, level, stars, power if visible.
  const hint = (body?.hint_name ?? "").trim();

  const prompt = [
    "You are extracting structured hero info from a mobile game screenshot.",
    "Return STRICT JSON ONLY with keys:",
    `{"name":string|null,"level":number|null,"stars":number|null,"power":number|null}`,
    "Rules:",
    "- name: hero name as displayed",
    "- level: integer",
    "- stars: integer (e.g. 5)",
    "- power: integer if visible",
    "- If a field is not visible, use null.",
    hint ? `User hint: hero might be "${hint}".` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const resp = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          {
            type: "input_image",
            image_url: { url: dataUrl, detail: "low" },
          },
        ],
      },
    ],
  });

  const text = resp.output_text?.trim() ?? "";
  let extracted: { name: string | null; level: number | null; stars: number | null; power: number | null } | null = null;

  try {
    extracted = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Model did not return valid JSON", raw: text.slice(0, 800) },
      { status: 500 }
    );
  }

  const name = extracted?.name ? String(extracted.name).trim() : "";
  const level = typeof extracted?.level === "number" ? extracted.level : null;
  const stars = typeof extracted?.stars === "number" ? extracted.stars : null;
  const power = typeof extracted?.power === "number" ? extracted.power : null;

  if (!name) {
    return NextResponse.json({ ok: false, error: "Could not read hero name from image", extracted }, { status: 422 });
  }

  // Save to facts with UPSERT to avoid duplicate constraint
  const domain = "hero_profile";
  const key = `hero:${canonHeroKey(name)}`; // canonical key avoids Murphy vs murphy duplicates

  const value = {
    name,
    level,
    stars,
    power,
    source_upload_id: uploadId,
    extracted_at: new Date().toISOString(),
  };

  const fx = await sb
    .from("facts")
    .upsert(
      {
        domain,
        key,
        value,
        status: "active",
        confidence: 0.85,
        source_urls: [],
        created_by_profile_id: s.profileId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "domain,key" }
    )
    .select("id, domain, key, value, updated_at")
    .single();

  if (fx.error) {
    return NextResponse.json({ ok: false, error: `Facts upsert failed: ${fx.error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, extracted: value, fact: fx.data });
}
