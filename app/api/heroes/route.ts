// app/api/heroes/route.ts
import { NextResponse } from "next/server";
import { HERO_CATALOG } from "./catalog";
import { Rarity, SquadType } from "./schema";

export function GET(req: Request) {
  const url = new URL(req.url);

  const rarity = url.searchParams.get("rarity");
  const squadType = url.searchParams.get("squadType");
  const full = url.searchParams.get("full") === "1" || url.searchParams.get("full") === "true";

  // Validate query params (optional)
  const rarityParsed = rarity ? Rarity.safeParse(rarity) : null;
  const squadTypeParsed = squadType ? SquadType.safeParse(squadType) : null;

  if (rarity && !rarityParsed?.success) {
    return NextResponse.json(
      { error: "Invalid rarity", allowed: Rarity.options },
      { status: 400 }
    );
  }

  if (squadType && !squadTypeParsed?.success) {
    return NextResponse.json(
      { error: "Invalid squadType", allowed: SquadType.options },
      { status: 400 }
    );
  }

  let heroes = HERO_CATALOG.heroes;

  if (rarityParsed?.success) {
    heroes = heroes.filter((h) => h.rarity === rarityParsed.data);
  }
  if (squadTypeParsed?.success) {
    heroes = heroes.filter((h) => h.squadType === squadTypeParsed.data);
  }

  const payload = full
    ? {
        ok: true,
        version: HERO_CATALOG.version,
        traits: HERO_CATALOG.traits ?? [],
        total: heroes.length,
        heroes,
      }
    : {
        ok: true,
        version: HERO_CATALOG.version,
        traitsCount: (HERO_CATALOG.traits ?? []).length,
        total: heroes.length,
        heroes: heroes.map((h) => ({
          id: h.id,
          name: h.name,
          rarity: h.rarity,
          squadType: h.squadType,

          primaryRole: h.primaryRole,
          secondaryRoles: h.secondaryRoles ?? [],
          damageProfile: h.damageProfile,
          utilityTags: h.utilityTags ?? [],

          inherentTraitIds: h.inherentTraitIds ?? [],
          skillsCount: h.skills.length,

          // ✅ permanently safe
          hasPromotion: (h.promotionRules?.length ?? 0) > 0,
        })),
      };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
