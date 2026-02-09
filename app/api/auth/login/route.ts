import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { signSession, sessionCookieName } from "@/lib/session";
import { compare } from "bcryptjs";

type ProfileRow = {
  id: string;
  username: string;
  pass_hash: string;
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = (body as any).username?.toString()?.trim() as string | undefined;
  const password = (body as any).password?.toString() as string | undefined;
  const rememberDevice = !!(body as any).rememberDevice;

  if (!username || !password) {
    return NextResponse.json({ error: "Missing username or password" }, { status: 400 });
  }

  const sb: any = supabaseAdmin(); // ✅ hard cast to stop TS blocking

  const q = await sb
    .from("profiles")
    .select("id, username, pass_hash")
    .eq("username", username)
    .maybeSingle();

  if (q.error) {
    return NextResponse.json({ error: q.error.message }, { status: 500 });
  }
  if (!q.data) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const profile = q.data as ProfileRow;

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
