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

type UploadRow = {
  id: number;
  kind: string;
  storage_bucket: string;
  storage_path: string;
  created_at: string;
};

export async function GET(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kind = (searchParams.get("kind") || "hero_profile").trim();
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 80), 1), 200);

  const sb: any = supabaseAdmin();

  const q = await sb
    .from("player_uploads")
    .select("id, kind, storage_bucket, storage_path, created_at")
    .eq("profile_id", s.profileId)
    .eq("kind", kind)
    .order("id", { ascending: false })
    .limit(limit);

  if (q.error) return NextResponse.json({ ok: false, error: q.error.message }, { status: 500 });

  const rows: UploadRow[] = (q.data ?? []) as UploadRow[];

  const uploads = [];
  for (const r of rows) {
    const bucket = r.storage_bucket || "uploads";
    const signed = await sb.storage.from(bucket).createSignedUrl(r.storage_path, 60 * 60);
    uploads.push({
      id: r.id,
      kind: r.kind,
      created_at: r.created_at,
      storage_path: r.storage_path,
      url: signed?.data?.signedUrl ?? null,
    });
  }

  return NextResponse.json({ ok: true, uploads });
}
