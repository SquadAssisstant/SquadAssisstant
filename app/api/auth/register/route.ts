import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { signSession, sessionCookieName } from "@/lib/session";
import { hash } from "bcryptjs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = (body as any).username?.toString()?.trim();
  const password = (body as any).password?.toString();
  const rememberDevice = !!(body as any).rememberDevice;

  if (!username || !password) {
    return NextResponse.json({ error: "Missing username or password" }, { status: 400 });
  }
  if (username.length < 3) return NextResponse.json({ error: "Username too short" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "Password too short" }, { status: 400 });

  const sb = supabaseAdmin(); // ✅ anchor the type
  const pass_hash = await hash(password, 10);

  const { data: profile, error: profileError } = await sb
    .from("profiles")
    .insert({ username, pass_hash })
    .select("id, username")
    .single();

  if (profileError || !profile) {
    if ((profileError as any)?.code === "23505") {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: profileError?.message ?? "Create profile failed" }, { status: 500 });
  }

  const { error: stateError } = await sb
    .from("player_state")
    .insert({ profile_id: profile.id, state: {} });

  if (stateError) {
    return NextResponse.json({ error: stateError.message }, { status: 500 });
  }

  const token = await signSession(
    { profileId: profile.id, username: profile.username },
    rememberDevice ? "30d" : "2h"
  );

  const res = NextResponse.json({ ok: true, username: profile.username });
  res.cookies.set(sessionCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(rememberDevice ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  });

  return res;
}
p
