import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/session";

export async function GET() {
  const token = (await cookies()).get(sessionCookieName())?.value;
  if (!token) return NextResponse.json({ ok: false, error: "no session" }, { status: 401 });

  const s = await verifySession(token);

  const sb = supabaseAdmin();

  const { data: reports, error: repErr } = await sb
    .from("battle_reports")
    .select("id, parsed, raw_storage_path, consent_scope")
    .eq("profile_id", s.profileId)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: pages, error: pageErr } = await sb
    .from("battle_report_pages")
    .select("id, report_id, page_index, storage_path, sha256")
    .eq("profile_id", s.profileId)
    .order("page_index", { ascending: true })
    .limit(200);

  return NextResponse.json({
    ok: true,
    profileId: s.profileId,
    reportsCount: reports?.length ?? 0,
    pagesCount: pages?.length ?? 0,
    reports,
    pages,
    repErr: repErr?.message ?? null,
    pageErr: pageErr?.message ?? null,
  });
}
