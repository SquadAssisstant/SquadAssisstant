import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createSession, sessionCookieName } from "@/lib/session";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { username, password } = body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    return NextResponse.json({ error: "Missing username or password" }, { status: 400 });
  }

  // 🔑 Query profile
  const { data: profile, error } = await supabaseAdmin()
    .from("profiles")
    .select("id, username, password_hash")
    .eq("username", username)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // 🔐 Verify password
  const ok = await verifyPassword(password, profile.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // 🎟 Create session
  const token = await createSession({
    profileId: profile.id,
    username: profile.username,
  });

  const res = NextResponse.json({ ok: true, username: profile.username });
  res.cookies.set({
    name: sessionCookieName(),
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return res;
}

/* ---------------- helpers ---------------- */

import { compare } from "bcryptjs";

async function verifyPassword(plain: string, hash: string) {
  try {
    return await compare(plain, hash);
  } catch {
    return false;
  }
}
