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

export async function GET(req: Request) {
  const token = getCookieFromHeader(req.headers.get("cookie"), sessionCookieName());

  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const s = await verifySession(token).catch(() => null);

  if (!s?.profileId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin() as any;

  const reports = await sb
    .from("battle_reports")
    .select(`
      id,
      profile_id,
      created_at,
      battle_report_pages (
        id,
        storage_bucket,
        storage_path,
        page_index,
        mime,
        bytes,
        created_at
      )
    `)
    .eq("profile_id", s.profileId)
    .order("created_at", { ascending: false });

  if (reports.error) {
    return NextResponse.json({ ok: false, error: reports.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    reports: reports.data ?? [],
  });
}
