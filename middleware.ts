import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionCookieName } from "@/lib/session";

const PUBLIC_PATHS = new Set([
  "/login",
  "/register",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
]);

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/assets")) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get(sessionCookieName())?.value;

  // If not logged in, redirect to /login
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    // optional: come back after login
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
