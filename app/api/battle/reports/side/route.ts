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

export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const reportId = String(body?.report_id ?? "").trim();
  const userSide = String(body?.user_side ?? "").trim();

  if (!reportId || !["left", "right"].includes(userSide)) {
    return NextResponse.json({ ok: false, error: "Missing report_id or valid user_side" }, { status: 400 });
  }

  const sb: any = supabaseAdmin();

  const current = await sb
    .from("battle_reports")
    .select("parsed")
    .eq("id", reportId)
    .eq("profile_id", s.profileId)
    .single();

  if (current.error) {
    return NextResponse.json({ ok: false, error: current.error.message }, { status: 500 });
  }

  const parsed = current.data?.parsed ?? {};

  const update = await sb
    .from("battle_reports")
    .update({
      parsed: {
        ...parsed,
        user_side: userSide,
      },
    })
    .eq("id", reportId)
    .eq("profile_id", s.profileId);

  if (update.error) {
    return NextResponse.json({ ok: false, error: update.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, user_side: userSide });
}
