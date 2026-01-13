import { NextResponse } from "next/server";
import { DRONE_CATALOG } from "./catalog";

export function GET() {
  return NextResponse.json(DRONE_CATALOG, {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
