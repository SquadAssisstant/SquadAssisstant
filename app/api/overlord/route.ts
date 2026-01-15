import { NextResponse } from "next/server";
import { GORILLA_CATALOG } from "./catalog";

export function GET() {
  return NextResponse.json(GORILLA_CATALOG, {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
