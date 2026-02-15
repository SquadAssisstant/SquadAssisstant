import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";

function getCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return undefined;
  return cookieHeader
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(name + "="))
    ?.slice(name.length + 1);
}

async function requireSession(req: Request) {
  const token = getCookie(req.headers.get("cookie"), sessionCookieName());
  if (!token) return null;
  try {
    return await verifySession(decodeURIComponent(token));
  } catch {
    return null;
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await requireSession(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const sb = supabaseAdmin() as any;

  const rep = await sb
    .from("battle_reports")
    .select("id, consent_scope, raw_storage_path, parsed")
    .eq("id", id)
    .eq("profile_id", s.profileId)
    .single();

  if (rep.error) return NextResponse.json({ error: rep.error.message }, { status: 500 });
  if (!rep.data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If you have pages table, include them; if not, this returns []
  const pages = await sb
    .from("battle_report_pages")
    .select("id, storage_bucket, storage_path, page_index, sha256, mime, bytes")
    .eq("report_id", id)
    .eq("profile_id", s.profileId)
    .order("page_index", { ascending: true });

  if (pages.error) return NextResponse.json({ error: pages.error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    report: rep.data,
    pages: pages.data ?? [],
  });
}
