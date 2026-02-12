// app/api/heroes/route.ts
import { NextResponse } from "next/server";
import { HERO_CATALOG } from "./catalog";

export function GET(req: Request) {
  const url = new URL(req.url);
  const rarity = url.searchParams.get("rarity");
  const squadType = url.searchParams.get("squadType");

  let heroes = HERO_CATALOG.heroes;

  if (rarity) {
    heroes = heroes.filter((h) => h.rarity === rarity);
  }
  if (squadType) {
    heroes = heroes.filter((h) => h.squadType === squadType);
  }

  const list = heroes.map((h) => ({
    id: h.id,
    name: h.name,
    rarity: h.rarity,
    squadType: h.squadType,
    primaryRole: h.primaryRole,
    secondaryRoles: h.secondaryRoles,
    damageProfile: h.damageProfile,

    // ✅ FIX: promotionRules may be undefined
    hasPromotion: (h.promotionRules?.length ?? 0) > 0,

    inherentTraitIds: h.inherentTraitIds,
    skillsCount: h.skills.length,
  }));

  return NextResponse.json(
    {
      ok: true,
      version: HERO_CATALOG.version,
      traitsCount: HERO_CATALOG.traits?.length ?? 0,
      total: list.length,
      heroes: list,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}
