import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/session";

function readCookieValue(cookieStore: any, name: string): string | undefined {
  // Some Next typings don't expose .get(), so prefer getAll() which is widely typed.
  if (cookieStore?.getAll) {
    const found = cookieStore.getAll().find((c: any) => c?.name === name);
    return found?.value;
  }
  // Runtime fallback if getAll isn't present
  if (typeof cookieStore?.get === "function") {
    return cookieStore.get(name)?.value;
  }
  return undefined;
}

export async function GET() {
  const cookieStore = await cookies();
  const token = readCookieValue(cookieStore as any, sessionCookieName());

  if (!token) return NextResponse.json({ authed: false });

  try {
    const s = await verifySession(token);
    return NextResponse.json({ authed: true, username: s.username, profileId: s.profileId });
  } catch {
    return NextResponse.json({ authed: false });
  }
}
