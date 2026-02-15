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

export async function POST(req: Request) {
  const s = await requireSession(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // kind is optional: "battle_report" | "hero_profile" | etc.
  const kind = (body as any).kind ? String((body as any).kind) : "battle_report";
  const consent_scope = (body as any).consent_scope ? String((body as any).consent_scope) : "private";

  // ✅ cast to any so .from() doesn't become never in prod build
  const sb = supabaseAdmin() as any;

  // Create the report container
  const created = await sb
    .from("battle_reports")
    .insert({
      profile_id: s.profileId,
      consent_scope,
      parsed: { kind, status: "collecting" },
    })
    .select("id")
    .single();

  if (created.error) {
    return NextResponse.json({ error: created.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    reportId: created.data.id,
    kind,
    status: "collecting",
  });
}
