import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
// adjust this import if your catalog lives elsewhere
import { HEROES_CATALOG } from "../catalog";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/heroes/[id]">) {
  const { id } = await ctx.params; // <-- params is async in newer Next builds

  const hero = HEROES_CATALOG.heroes.find((h) => h.id === id.toLowerCase());

  if (!hero) {
    return NextResponse.json({ error: "Hero not found", id }, { status: 404 });
  }

  return NextResponse.json(hero, {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
