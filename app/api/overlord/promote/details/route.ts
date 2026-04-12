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

function isOverlordKind(kind: unknown) {
  const k = String(kind ?? "").trim().toLowerCase();
  return ["overlord", "lord", "over_lord"].includes(k);
}

export async function GET(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const uploadId = Number(new URL(req.url).searchParams.get("upload_id") || "");
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
  if (!isOverlordKind(up.data.kind)) {
    return NextResponse.json(
      { ok: false, error: `Unsupported kind "${String(up.data.kind)}" for overlord promote details` },
      { status: 400 }
    );
  }

  const bucket = up.data.storage_bucket || "uploads";
  let image_url: string | null = null;

  if (up.data.storage_path) {
    const signed = await sb.storage.from(bucket).createSignedUrl(up.data.storage_path, 60 * 60);
    if (!signed.error) image_url = signed.data?.signedUrl ?? null;
  }

  let facts: any = null;

  const byUpload = await sb
    .from("facts")
    .select("id, domain, key, value, status, confidence, source_urls, created_at, updated_at")
    .eq("domain", "overlord_promote")
    .eq("created_by_profile_id", s.profileId)
    .eq("value->>source_upload_id", String(uploadId))
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (byUpload.error) {
    return NextResponse.json({ ok: false, error: byUpload.error.message }, { status: 500 });
  }

  facts = byUpload.data ?? null;

  if (!facts) {
    const key = `${s.profileId}:overlord_promote:upload_${uploadId}`;
    const byKey = await sb
      .from("facts")
      .select("id, domain, key, value, status, confidence, source_urls, created_at, updated_at")
      .eq("domain", "overlord_promote")
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
