import { NextResponse } from "next/server";
import { HERO_CATALOG } from "@/app/api/heroes/catalog";

export function GET(_req: Request, { params }: { params: { id: string } }) {
  const hero = HERO_CATALOG.heroes.find(h => h.id === params.id);

  if (!hero) {
    return NextResponse.json(
      { error: "Hero not found", hint: "Use /api/heroes to list ids." },
      { status: 404 }
    );
  }

  return NextResponse.json(hero, {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" },
  });
}

