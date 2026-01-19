import { NextResponse } from "next/server";
import { HEROES_CATALOG } from "../catalog"; // adjust if your catalog path differs

export function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id?.toLowerCase();

  const hero = HEROES_CATALOG.heroes.find((h) => h.id === id);

  if (!hero) {
    return NextResponse.json(
      { error: "Hero not found", id },
      { status: 404 }
    );
  }

  return NextResponse.json(hero, {
    headers: {
      "Cache-Control":
        "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
