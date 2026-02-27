import { NextResponse } from "next/server";
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

function normalizeHeroKey(raw: string | null) {
  return String(raw ?? "").trim().toLowerCase();
}

export async function GET(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const uploadId = Number(searchParams.get("upload_id") || "");
  if (!Number.isFinite(uploadId)) {
    return NextResponse.json({ ok: false, error: "Missing/invalid upload_id" }, { status: 400 });
  }

  const hero_key = normalizeHeroKey(searchParams.get("hero_key"));

  const sb: any = supabaseAdmin();

  const up = await sb
    .from("player_uploads")
    .select("id, kind, storage_bucket, storage_path, created_at, facts_id")
    .eq("id", uploadId)
    .eq("profile_id", s.profileId)
    .maybeSingle();

  if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  if (!up.data) return NextResponse.json({ ok: false, error: "Upload not found" }, { status: 404 });

  const bucket = up.data.storage_bucket || "uploads";
  const signed = await sb.storage.from(bucket).createSignedUrl(up.data.storage_path, 60 * 60);

  let facts: any = null;

  // 1) Prefer facts_id link
  if (up.data.facts_id) {
    const fx = await sb
      .from("facts")
      .select("id, domain, key, value, status, confidence, source_urls, created_at, updated_at")
      .eq("id", up.data.facts_id)
      .maybeSingle();

    if (fx.error) return NextResponse.json({ ok: false, error: fx.error.message }, { status: 500 });
    facts = fx.data ?? null;
  }

  // 2) Fallback (only if caller supplies hero_key)
  // IMPORTANT: must match where hero facts are actually stored by /api/hero/save
  if (!facts && hero_key) {
    const domain = "hero_profile";
    const key = `${s.profileId}:hero:${hero_key}`;

    const fx2 = await sb
      .from("facts")
      .select("id, domain, key, value, status, confidence, source_urls, created_at, updated_at")
      .eq("domain", domain)
      .eq("key", key)
      .maybeSingle();

    if (fx2.error) return NextResponse.json({ ok: false, error: fx2.error.message }, { status: 500 });
    facts = fx2.data ?? null;

    if (facts?.id) {
      await sb
        .from("player_uploads")
        .update({ facts_id: facts.id })
        .eq("id", uploadId)
        .eq("profile_id", s.profileId);
    }
  }

  return NextResponse.json({
    ok: true,
    upload: up.data,
    image_url: signed?.data?.signedUrl ?? null,
    facts,
  });
}
