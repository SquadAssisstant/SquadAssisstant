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

export async function GET(req: Request) {
  const sess = await requireSessionFromReq(req);
  if (!sess) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const uploadIdRaw = searchParams.get("upload_id");
  const uploadId = uploadIdRaw ? Number(uploadIdRaw) : null;

  const sb: any = supabaseAdmin();

  let image_url: string | null = null;

  if (uploadIdRaw) {
    if (!Number.isFinite(uploadId)) {
      return NextResponse.json({ ok: false, error: "Invalid upload_id" }, { status: 400 });
    }

    const up = await sb
      .from("player_uploads")
      .select("id, kind, storage_bucket, storage_path")
      .eq("id", uploadId)
      .eq("profile_id", sess.profileId)
      .maybeSingle();

    if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
    if (!up.data) return NextResponse.json({ ok: false, error: "Upload not found" }, { status: 404 });

    const bucket = up.data.storage_bucket || "uploads";
    const path = String(up.data.storage_path || "");
    if (path) {
      const signed = await sb.storage.from(bucket).createSignedUrl(path, 60 * 60);
      if (!signed.error) image_url = signed.data?.signedUrl ?? null;
    }
  }

  const key = `${sess.profileId}:drone`;

  const fx = await sb
    .from("facts")
    .select("id, domain, key, value, status, confidence, source_urls, created_at, updated_at")
    .eq("domain", "drone")
    .eq("key", key)
    .eq("created_by_profile_id", sess.profileId)
    .maybeSingle();

  if (fx.error) return NextResponse.json({ ok: false, error: fx.error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    image_url,
    facts: fx.data ?? null,
  });
}
