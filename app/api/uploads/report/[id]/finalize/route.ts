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

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await requireSession(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: reportId } = await ctx.params;

  // ✅ cast to any to avoid "never" table typing during prod build
  const sb = supabaseAdmin() as any;

  // Count pages for this report (and this profile)
  const pages = await sb
    .from("battle_report_pages")
    .select("id", { count: "exact", head: true })
    .eq("report_id", reportId)
    .eq("profile_id", s.profileId);

  if (pages.error) return NextResponse.json({ error: pages.error.message }, { status: 500 });

  const pageCount = pages.count ?? 0;

  // Mark report ready
  const upd = await sb
    .from("battle_reports")
    .update({
      parsed: {
        kind: "battle_report",
        status: "ready",
        pageCount,
      },
    })
    .eq("id", reportId)
    .eq("profile_id", s.profileId);

  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 });

  return NextResponse.json({ ok: true, reportId, pageCount, status: "ready" });
}
