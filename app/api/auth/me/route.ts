import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/session";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value;

  if (!token) return NextResponse.json({ authed: false });

  try {
    const s = await verifySession(token);
    return NextResponse.json({ authed: true, username: s.username, profileId: s.profileId });
  } catch {
    return NextResponse.json({ authed: false });
  }
}
