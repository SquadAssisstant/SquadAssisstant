// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionCookieName, verifySession } from "@/lib/session";

function isPublicPath(pathname: string) {
  // Public API routes
  if (
    pathname === "/api/heroes" ||
    pathname.startsWith("/api/heroes/") ||
    pathname === "/api/gear" ||
    pathname === "/api/drone" ||
    pathname === "/api/overlord" ||
    pathname.startsWith("/api/auth/") || // ✅ allow auth endpoints
    pathname === "/api/chat" ||          // keep template chat if you want
    pathname === "/"
  ) {
    return true;
  }

  // Static / Next internals
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) return true;

  // Allow assets
  if (pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|css|js)$/)) return true;

  return false;
}

function getCookieFromHeader(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
  }
  return undefined;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  // Protect only the routes that must be authed:
  // /api/player/* , /api/uploads/* , /api/battle/*
  const mustAuth =
    pathname.startsWith("/api/player/") ||
    pathname.startsWith("/api/uploads/") ||
    pathname.startsWith("/api/battle/");

  if (!mustAuth) return NextResponse.next();

  const token = getCookieFromHeader(req.headers.get("cookie"), sessionCookieName());
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await verifySession(token);
    return NextResponse.next();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export const config = {
  matcher: ["/api/:path*"],
};
