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

  const body = await req.json().catch(() => ({}));
  const declaredKind = typeof body?.kind === "string" ? body.kind : "battle_report";

  const sb = supabaseAdmin();

  // Create the report container
  const created = await sb
    .from("battle_reports")
    .insert({
      profile_id: s.profileId,
      consent_scope: "private",
      parsed: {
        kind: declaredKind,
        status: "draft",
      },
    })
    .select("id")
    .single();

  if (created.error) return NextResponse.json({ error: created.error.message }, { status: 500 });

  return NextResponse.json({ ok: true, reportId: created.data.id });
}
