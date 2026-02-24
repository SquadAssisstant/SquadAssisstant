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

async function requireSessionFromReq(req: Request) {
  const token = getCookieFromHeader(req.headers.get("cookie"), sessionCookieName());
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const bucket = searchParams.get("bucket") || "uploads";
  const path = searchParams.get("path");

  if (!path) return NextResponse.json({ ok: false, error: "Missing path" }, { status: 400 });

  // Optional: only allow signing objects that belong to this user by checking DB
  const sb: any = supabaseAdmin();

  const check = await sb
    .from("player_uploads")
    .select("id")
    .eq("profile_id", s.profileId)
    .eq("storage_path", path)
    .limit(1)
    .maybeSingle();

  if (check.error) return NextResponse.json({ ok: false, error: check.error.message }, { status: 500 });
  if (!check.data) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const signed = await sb.storage.from(bucket).createSignedUrl(path, 60 * 60); // 1 hour

  if (signed.error) {
    return NextResponse.json({ ok: false, error: signed.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: signed.data.signedUrl });
}
