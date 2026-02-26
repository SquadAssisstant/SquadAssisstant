import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";

export const runtime = "nodejs";

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

function toIntOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d]/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function normalizeHeroName(name: unknown): string {
  const s = String(name ?? "").trim();
  if (!s) return "";
  // keep user-facing capitalization nice, but normalize for keys separately
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}

export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { upload_id?: number } | null;
  const uploadId = Number(body?.upload_id);
  if (!Number.isFinite(uploadId)) {
    return NextResponse.json({ ok: false, error: "Missing/invalid upload_id" }, { status: 400 });
  }

  const sb: any = supabaseAdmin();

  // Verify upload belongs to this profile
  const up = await sb
    .from("player_uploads")
    .select("id, kind, storage_bucket, storage_path")
    .eq("id", uploadId)
    .eq("profile_id", s.profileId)
    .maybeSingle();

  if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  if (!up.data) return NextResponse.json({ ok: false, error: "Upload not found" }, { status: 404 });

  const bucket = up.data.storage_bucket || "uploads";
  const signed = await sb.storage.from(bucket).createSignedUrl(up.data.storage_path, 60 * 60);
  const imageUrl: string | null = signed?.data?.signedUrl ?? null;

  if (!imageUrl) {
    return NextResponse.json({ ok: false, error: "Could not create signed URL for image" }, { status: 500 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "OPENAI_API_KEY missing" }, { status: 500 });
  }

  const client = new OpenAI({ apiKey });

  // Tight prompt: cheap + reliable.
  const prompt = [
    "You are extracting a hero profile from a mobile game screenshot.",
    "Return ONLY valid JSON (no markdown, no commentary).",
    "Fields:",
    "- name: string (hero name)",
    "- level: number (hero level)",
    "- stars: number (hero star count)",
    "- power: number|null (if visible; else null)",
    "",
    "If a field is not visible, set it to null (except name: if unknown, use empty string).",
  ].join("\n");

  const resp = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          // ✅ FIX: detail is required by the SDK typing
          { type: "input_image", image_url: imageUrl, detail: "low" },
        ],
      },
    ],
    // keep it cheap
    max_output_tokens: 300,
  });

  const raw = resp.output_text?.trim() ?? "";
  let parsed: any = null;

  try {
    parsed = JSON.parse(raw);
  } catch {
    // fallback: try to salvage first JSON object
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch {}
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return NextResponse.json(
      { ok: false, error: "Model did not return valid JSON", raw: raw.slice(0, 500) },
      { status: 500 }
    );
  }

  const name = normalizeHeroName(parsed.name);
  const level = toIntOrNull(parsed.level);
  const stars = toIntOrNull(parsed.stars);
  const power = toIntOrNull(parsed.power);

  // Key MUST be stable and MUST avoid collisions across profiles.
  // Also normalize name for key matching (case-insensitive).
  const keyName = (name || `upload_${uploadId}`).trim().toLowerCase();
  const domain = "hero_profile";
  const key = `${s.profileId}:hero:${keyName}`;

  const value = {
    kind: "hero_profile",
    name: name || null,
    level,
    stars,
    power,
    source: { upload_id: uploadId },
  };

  // ✅ Upsert into facts so we don't trip the unique constraint on (domain,key).
  const fx = await sb
    .from("facts")
    .upsert(
      {
        domain,
        key,
        value,
        status: "confirmed",
        confidence: 0.8,
        source_urls: [up.data.storage_path],
        created_by_profile_id: s.profileId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "domain,key" }
    )
    .select("id, domain, key, value, status, confidence, updated_at")
    .single();

  if (fx.error) {
    return NextResponse.json({ ok: false, error: fx.error.message }, { status: 500 });
  }

  // Link upload -> facts
  const link = await sb
    .from("player_uploads")
    .update({ facts_id: fx.data.id })
    .eq("id", uploadId)
    .eq("profile_id", s.profileId);

  if (link.error) {
    return NextResponse.json({ ok: false, error: link.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, facts: fx.data });
}
