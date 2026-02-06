import { NextResponse } from "next/server";
import { sessionCookieName, verifySession } from "@/lib/session";

function getCookieFromHeader(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map(p => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
  }
  return undefined;
}

export async function GET(req: Request) {
  const token = getCookieFromHeader(req.headers.get("cookie"), sessionCookieName());

  if (!token) return NextResponse.json({ authed: false });

  try {
    const s = await verifySession(token);
    return NextResponse.json({ authed: true, username: s.username, profileId: s.profileId });
  } catch {
    return NextResponse.json({ authed: false });
  }
}
