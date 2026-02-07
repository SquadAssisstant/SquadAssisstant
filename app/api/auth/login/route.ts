import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { signSession, sessionCookieName } from "@/lib/session";
import { compare } from "bcryptjs";

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

  const { data: profile, error } = await supabaseAdmin()
    .from("profiles")
    .select("id, username, pass_hash")
    .eq("username", username)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ok = await compare(password, profile.pass_hash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
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
