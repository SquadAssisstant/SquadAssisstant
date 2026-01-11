import { NextResponse } from "next/server";
import { HERO_CATALOG } from "@/app/api/heroes/catalog";
import { Rarity, SquadType } from "@/app/api/heroes/schema";

export function GET(req: Request) {
  const url = new URL(req.url);
  const rarity = url.searchParams.get("rarity");
  const squadType = url.searchParams.get("squadType");

  const rarityParsed = rarity ? Rarity.safeParse(rarity) : null;
  const squadParsed = squadType ? SquadType.safeParse(squadType) : null;

  if (rarity && !rarityParsed?.success) {
    return NextResponse.json({ error: "Invalid rarity", allowed: Rarity.options }, { status: 400 });
  }
  if (squadType && !squadParsed?.success) {
    return NextResponse.json({ error: "Invalid squadType", allowed: SquadType.options }, { status: 400 });
  }

  let heroes = HERO_CATALOG.heroes;
  if (rarityParsed?.success) heroes = heroes.filter(h => h.rarity === rarityParsed.data);
  if (squadParsed?.success) heroes = heroes.filter(h => h.squadType === squadParsed.data);

  const summary = heroes.map(h => ({
    id: h.id,
    name: h.name,
    rarity: h.rarity,
    squadType: h.squadType,
    primaryRole: h.primaryRole,
    secondaryRoles: h.secondaryRoles,
    damageProfile: h.damageProfile,
    hasPromotion: h.promotionRules.length > 0,
    inherentTraitIds: h.inherentTraitIds,
    skillsCount: h.skills.length,
  }));

  return NextResponse.json(
    { version: HERO_CATALOG.version, heroes: summary },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" } }
  );
}

