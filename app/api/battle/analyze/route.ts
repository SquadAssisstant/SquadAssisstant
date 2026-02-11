import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";
import { analyzeParsedReport } from "@/app/api/battle/_lib/analyzer";

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
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb: any = supabaseAdmin();

  const { data, error } = await sb
    .from("battle_reports")
    .select("id, parsed")
    .eq("profile_id", s.profileId)
    .order("id", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const analyses = (data ?? []).map((r: any) => analyzeParsedReport(r.id, r.parsed ?? {}));
  return NextResponse.json({ ok: true, count: analyses.length, analyses });
}
