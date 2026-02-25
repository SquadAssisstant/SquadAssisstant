import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";
import OpenAI from "openai";

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

function normKey(s: string) {
  return s.trim().toLowerCase();
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Try to salvage JSON inside fences / extra text
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as T;
    } catch {
      return null;
    }
  }
}

type ExtractedHero = {
  hero_name?: string | null;
  hero_key?: string | null; // optional override
  level?: number | null;
  stars?: number | null;
  power?: number | null;
  skills?: Array<{ name?: string; level?: number | null }>;
  gear?: Array<{ name?: string; tier?: string; level?: number | null }>;
  notes?: string | null;
};

export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { upload_id?: number | string } | null;
  const upload_id = body?.upload_id === undefined ? NaN : Number(body.upload_id);
  if (!Number.isFinite(upload_id)) {
    return NextResponse.json({ ok: false, error: "Missing/invalid upload_id" }, { status: 400 });
  }

  const sb: any = supabaseAdmin();

  // Load upload row
  const up = await sb
    .from("player_uploads")
    .select("id, kind, storage_bucket, storage_path, created_at, facts_id")
    .eq("id", upload_id)
    .eq("profile_id", s.profileId)
    .maybeSingle();

  if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  if (!up.data) return NextResponse.json({ ok: false, error: "Upload not found" }, { status: 404 });

  const bucket: string = up.data.storage_bucket || "uploads";
  const storage_path: string = up.data.storage_path;

  // Download bytes from storage
  const dl = await sb.storage.from(bucket).download(storage_path);
  if (dl.error) return NextResponse.json({ ok: false, error: dl.error.message }, { status: 500 });

  const arrayBuffer = await dl.data.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);

  // Best-effort MIME from path (fallback)
  const lower = String(storage_path).toLowerCase();
  const mime =
    lower.endsWith(".png")
      ? "image/png"
      : lower.endsWith(".webp")
      ? "image/webp"
      : lower.endsWith(".gif")
      ? "image/gif"
      : "image/jpeg";

  const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return NextResponse.json(
      { ok: false, error: "OPENAI_API_KEY is missing on the server" },
      { status: 500 }
    );
  }

  const client = new OpenAI({ apiKey });

  // Keep cost down:
  // - use gpt-4o-mini (cheap, supports image input)
  // - limit tokens
  // - tell it to be conservative
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";

  const system = [
    "You extract structured hero profile data from a mobile game screenshot.",
    "Return ONLY valid JSON. No markdown, no commentary.",
    "If a field is not visible, use null.",
    "Be conservative: do not guess names/values you can't read.",
    "Skills and gear can be partial; include what is clearly visible.",
  ].join(" ");

  const user = [
    "Extract these fields from the image:",
    "- hero_name (string|null) : the displayed hero name",
    "- level (number|null) : hero level",
    "- stars (number|null) : star count",
    "- power (number|null) : total power number",
    "- skills (array) : [{name, level}] if visible",
    "- gear (array) : [{name, tier, level}] if visible",
    "- notes (string|null) : short note if something important is unclear",
    "",
    "Return JSON with keys: hero_name, level, stars, power, skills, gear, notes",
  ].join("\n");

  // Use Responses API (works with OpenAI JS SDK v4+)
  const resp = await client.responses.create({
    model,
    input: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "input_text", text: user },
          { type: "input_image", image_url: dataUrl },
        ],
      },
    ],
    max_output_tokens: 450,
  });

  const rawText = resp.output_text ?? "";
  const extracted = safeJsonParse<ExtractedHero>(rawText);

  if (!extracted) {
    return NextResponse.json(
      { ok: false, error: "Model did not return valid JSON", raw: rawText.slice(0, 800) },
      { status: 502 }
    );
  }

  const hero_name = extracted.hero_name ? String(extracted.hero_name).trim() : "";
  const hero_key = extracted.hero_key
    ? normKey(String(extracted.hero_key))
    : hero_name
    ? normKey(hero_name)
    : `upload_${upload_id}`;

  const value = {
    hero_key,
    display_name: hero_name || null,
    level: Number.isFinite(Number(extracted.level)) ? Number(extracted.level) : null,
    stars: Number.isFinite(Number(extracted.stars)) ? Number(extracted.stars) : null,
    power: Number.isFinite(Number(extracted.power)) ? Number(extracted.power) : null,
    skills: Array.isArray(extracted.skills) ? extracted.skills : [],
    gear: Array.isArray(extracted.gear) ? extracted.gear : [],
    notes: extracted.notes ?? null,
    extracted_from: {
      upload_id,
      bucket,
      storage_path,
      model,
      at: new Date().toISOString(),
    },
  };

  // Upsert facts row (domain,key unique)
  const fx = await sb
    .from("facts")
    .upsert(
      {
        domain: "hero",
        key: hero_key,
        value,
        status: "active",
        confidence: 0.85,
        source_urls: [],
        created_by_profile_id: s.profileId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "domain,key" }
    )
    .select("id, domain, key")
    .single();

  if (fx.error) {
    return NextResponse.json({ ok: false, error: fx.error.message }, { status: 500 });
  }

  // Link upload -> facts_id so /api/hero/details works immediately
  const link = await sb
    .from("player_uploads")
    .update({ facts_id: fx.data.id })
    .eq("id", upload_id)
    .eq("profile_id", s.profileId);

  if (link.error) {
    // Not fatal for extraction, but helpful to know
    return NextResponse.json({
      ok: true,
      warning: `Extracted + saved facts, but failed to link player_uploads.facts_id: ${link.error.message}`,
      upload_id,
      facts_id: fx.data.id,
      hero_key,
      extracted: value,
    });
  }

  return NextResponse.json({
    ok: true,
    upload_id,
    facts_id: fx.data.id,
    hero_key,
    extracted: value,
  });
    }
