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
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const consent = url.searchParams.get("consent");

  const limit = Math.max(1, Math.min(200, Number(limitRaw ?? "50") || 50));

  const sb: any = supabaseAdmin(); // ✅ hard cast + called

  let q = sb
    .from("battle_reports")
    .select("id, created_at, consent_scope, raw_storage_path, parsed")
    .eq("profile_id", s.profileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (consent) {
    q = q.eq("consent_scope", consent);
  }

  const { data, error } = await q;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, username: s.username, count: data?.length ?? 0, items: data ?? [] });
}
