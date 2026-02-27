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

function normalizeHeroName(name: unknown): string {
  const s = String(name ?? "").trim();
  if (!s) return "";
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}

function toIntOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d]/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function stableHeroKeyName(name: string, uploadId: number) {
  // Match /api/hero/save behavior: lowercase key name, but do not change UI
  const n = (name || `upload_${uploadId}`).trim().toLowerCase();
  return n;
}

function pushHistory(existingValue: any, newSnapshot: any) {
  const prev = existingValue && typeof existingValue === "object" ? existingValue : null;
  if (!prev) return newSnapshot;

  // If effectively identical, don't spam history
  const prevCore = JSON.stringify({
    name: prev.name ?? null,
    level: prev.level ?? null,
    stars: prev.stars ?? null,
    power: prev.power ?? null,
  });
  const nextCore = JSON.stringify({
    name: newSnapshot.name ?? null,
    level: newSnapshot.level ?? null,
    stars: newSnapshot.stars ?? null,
    power: newSnapshot.power ?? null,
  });

  if (prevCore === nextCore) return { ...prev, ...newSnapshot };

  const history = Array.isArray(prev._history) ? prev._history.slice(0) : [];
  history.unshift({
    at: new Date().toISOString(),
    value: {
      name: prev.name ?? null,
      level: prev.level ?? null,
      stars: prev.stars ?? null,
      power: prev.power ?? null,
      source: prev.source ?? null,
      source_upload_id: prev.source_upload_id ?? null,
      extracted_at: prev.extracted_at ?? null,
    },
  });

  // Keep history bounded so the row doesn't grow forever
  const bounded = history.slice(0, 50);

  return {
    ...prev,
    ...newSnapshot,
    _history: bounded,
  };
}

export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { upload_id?: number; hint_name?: string | null }
    | null;

  const uploadId = Number(body?.upload_id);
  if (!Number.isFinite(uploadId)) {
    return NextResponse.json({ ok: false, error: "Missing/invalid upload_id" }, { status: 400 });
  }

  const sb: any = supabaseAdmin();

  const up = await sb
    .from("player_uploads")
    .select("id, kind, storage_bucket, storage_path, created_at")
    .eq("id", uploadId)
    .eq("profile_id", s.profileId)
    .maybeSingle();

  if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  if (!up.data) return NextResponse.json({ ok: false, error: "Upload not found" }, { status: 404 });

  if (up.data.kind !== "hero_profile") {
    return NextResponse.json(
      { ok: false, error: `Upload kind must be hero_profile (got ${up.data.kind})` },
      { status: 400 }
    );
  }

  const bucket = up.data.storage_bucket || "uploads";
  const path = String(up.data.storage_path || "");
  if (!path) return NextResponse.json({ ok: false, error: "Upload missing storage_path" }, { status: 500 });

  const dl = await sb.storage.from(bucket).download(path);
  if (dl.error) {
    return NextResponse.json(
      { ok: false, error: `Storage download failed: ${dl.error.message}` },
      { status: 500 }
    );
  }

  const ab = await dl.data.arrayBuffer();
  const bytes = new Uint8Array(ab);
  const mime = guessMimeFromPath(path);
  const dataUrl = toDataUrl(mime, bytes);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: "OPENAI_API_KEY missing" }, { status: 500 });

  const client = new OpenAI({ apiKey });

  const hint = (body?.hint_name ?? "").trim();
  const prompt = [
    "You are extracting structured hero info from a mobile game screenshot.",
    "Return STRICT JSON ONLY with keys:",
    `{"name":string|null,"level":number|null,"stars":number|null,"power":number|null}`,
    "Rules:",
    "- name: hero name as displayed",
    "- level: integer",
    "- stars: integer",
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
          // IMPORTANT for build correctness: image_url is a string, detail is top-level
          { type: "input_image", image_url: dataUrl, detail: "low" },
        ],
      },
    ],
  });

  const text = resp.output_text?.trim() ?? "";
  let extracted: { name: string | null; level: number | null; stars: number | null; power: number | null } | null = null;

  try {
    extracted = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "Model did not return valid JSON", raw: text.slice(0, 800) }, { status: 500 });
  }

  const name = normalizeHeroName(extracted?.name);
  const level = toIntOrNull(extracted?.level);
  const stars = toIntOrNull(extracted?.stars);
  const power = toIntOrNull(extracted?.power);

  if (!name) {
    return NextResponse.json({ ok: false, error: "Could not read hero name from image", extracted }, { status: 422 });
  }

  // IMPORTANT: match /api/hero/save identity
  const keyName = stableHeroKeyName(name, uploadId);
  const domain = "hero_profile";
  const key = `${s.profileId}:hero:${keyName}`;

  // Pull existing row to preserve history (no new tables)
  const existing = await sb
    .from("facts")
    .select("id, value")
    .eq("domain", domain)
    .eq("key", key)
    .maybeSingle();

  if (existing.error) {
    return NextResponse.json({ ok: false, error: existing.error.message }, { status: 500 });
  }

  const newSnapshot = {
    kind: "hero_profile",
    name: name || null,
    level,
    stars,
    power,
    source_upload_id: uploadId,
    extracted_at: new Date().toISOString(),
    source: { upload_id: uploadId, manual: false },
  };

  const mergedValue = pushHistory(existing.data?.value, newSnapshot);

  const fx = await sb
    .from("facts")
    .upsert(
      {
        domain,
        key,
        value: mergedValue,
        status: "active",
        confidence: 0.85,
        source_urls: [path],
        created_by_profile_id: s.profileId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "domain,key" }
    )
    .select("id")
    .single();

  if (fx.error) {
    return NextResponse.json({ ok: false, error: `Facts upsert failed: ${fx.error.message}` }, { status: 500 });
  }

  // CRITICAL: link upload -> facts_id so hero modal loads the extracted fact deterministically
  const link = await sb
    .from("player_uploads")
    .update({ facts_id: fx.data.id })
    .eq("id", uploadId)
    .eq("profile_id", s.profileId);

  if (link.error) {
    return NextResponse.json({ ok: false, error: link.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
        }
