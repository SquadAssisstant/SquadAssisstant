import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { signSession, sessionCookieName } from "@/lib/session";

function normalizeUsername(u: string) {
  return u.trim();
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const username = normalizeUsername((body?.username ?? "").toString());
  const password = (body?.password ?? "").toString();
  const rememberDevice = !!body?.rememberDevice;

  if (!username || !password) {
    return NextResponse.json({ error: "Missing username or password." }, { status: 400 });
  }

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, username, pass_hash")
    .eq("username", username)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, profile.pass_hash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const token = await signSession(
    { profileId: profile.id, username: profile.username },
    rememberDevice ? "30d" : "2h"
  );

  const res = NextResponse.json({ ok: true });

  // If rememberDevice=false, cookie is session-only (no maxAge)
  res.cookies.set(sessionCookieName(), token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    ...(rememberDevice ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  });

  // Optional convenience: store last username for prefill (NOT sensitive)
  if (rememberDevice) {
    res.cookies.set("sa_last_user", encodeURIComponent(profile.username), {
      httpOnly: false,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return res;
}
