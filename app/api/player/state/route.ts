import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireSession() {
  const token = cookies().get(sessionCookieName())?.value;
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

export async function GET() {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("player_state")
    .select("state, updated_at")
    .eq("profile_id", s.profileId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, username: s.username, ...data });
}

export async function PATCH(req: Request) {
  const s = await requireSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Simple merge: client sends full state or partial state; we fetch & merge server-side.
  const existing = await supabaseAdmin
    .from("player_state")
    .select("state")
    .eq("profile_id", s.profileId)
    .single();

  if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 500 });

  const merged = { ...(existing.data?.state ?? {}), ...body };

  const { error } = await supabaseAdmin
    .from("player_state")
    .update({ state: merged })
    .eq("profile_id", s.profileId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
