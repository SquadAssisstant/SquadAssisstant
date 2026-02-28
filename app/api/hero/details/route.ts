import { NextResponse } from "next/server";
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

  // Optional: if UI ever passes this, we can use it as an additional fallback
  const hero_key = normalizeHeroKey(searchParams.get("hero_key"));

  const sb: any = supabaseAdmin();

  // 1) Load upload (ownership check + image path)
  const up = await sb
    .from("player_uploads")
    .select("id, kind, storage_bucket, storage_path, created_at")
    .eq("id", uploadId)
    .eq("profile_id", s.profileId)
    .maybeSingle();

  if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  if (!up.data) return NextResponse.json({ ok: false, error: "Upload not found" }, { status: 404 });

  // 2) Signed URL for image preview in the modal
  const bucket = up.data.storage_bucket || "uploads";
  let image_url: string | null = null;

  if (up.data.storage_path) {
    const signed = await sb.storage.from(bucket).createSignedUrl(up.data.storage_path, 60 * 60);
    if (!signed.error) image_url = signed.data?.signedUrl ?? null;
  }

  // 3) Load matching facts WITHOUT using player_uploads.facts_id
  // Because player_uploads.facts_id is BIGINT and facts.id is UUID in your DB.
  let facts: any = null;

  // Primary: match by source_upload_id stored in facts.value
  // We store source_upload_id as a number in value; Postgres JSON returns text, so compare as string.
  const byUpload = await sb
    .from("facts")
    .select("id, domain, key, value, status, confidence, source_urls, created_at, updated_at")
    .eq("domain", "hero_profile")
    .eq("created_by_profile_id", s.profileId)
    .eq("value->>source_upload_id", String(uploadId))
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (byUpload.error) {
    return NextResponse.json({ ok: false, error: byUpload.error.message }, { status: 500 });
  }
  facts = byUpload.data ?? null;

  // Secondary fallback: if a hero_key is provided, try the older keying scheme too
  // (This helps recover older facts you might have saved before source_upload_id was present.)
  if (!facts && hero_key) {
    const key = `${s.profileId}:hero:${hero_key}`;
    const byKey = await sb
      .from("facts")
      .select("id, domain, key, value, status, confidence, source_urls, created_at, updated_at")
      .eq("domain", "hero_profile")
      .eq("key", key)
      .eq("created_by_profile_id", s.profileId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (byKey.error) {
      return NextResponse.json({ ok: false, error: byKey.error.message }, { status: 500 });
    }
    facts = byKey.data ?? null;
  }

  return NextResponse.json({
    ok: true,
    upload: up.data,
    image_url,
    facts,
  });
}
