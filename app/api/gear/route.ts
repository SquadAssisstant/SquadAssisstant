import { NextResponse } from "next/server";
import { GEAR_CATALOG } from "./catalog";
import { GearSlot, GearRarity } from "./schema";

export function GET(req: Request) {
  const url = new URL(req.url);
  const slot = url.searchParams.get("slot");
  const rarity = url.searchParams.get("rarity");

  const slotParsed = slot ? GearSlot.safeParse(slot) : null;
  const rarityParsed = rarity ? GearRarity.safeParse(rarity) : null;

  if (slot && !slotParsed?.success) {
    return NextResponse.json({ error: "Invalid slot", allowed: GearSlot.options }, { status: 400 });
  }
  if (rarity && !rarityParsed?.success) {
    return NextResponse.json({ error: "Invalid rarity", allowed: GearRarity.options }, { status: 400 });
  }

  let items = GEAR_CATALOG.items;
  if (slotParsed?.success) items = items.filter(i => i.slot === slotParsed.data);
  if (rarityParsed?.success) items = items.filter(i => i.rarity === rarityParsed.data);

  // summary response (fast)
  const summary = items.map(i => ({
    id: i.id,
    name: i.name,
    slot: i.slot,
    rarity: i.rarity,
    basePower: i.basePower,
    baseStats: i.baseStats,
    baseEffects: i.baseEffects,
    milestones: i.milestones,
    blueprintRule: i.blueprintRule ?? null,
    notes: i.notes ?? null,
  }));

  return NextResponse.json(
    { version: GEAR_CATALOG.version, slots: GEAR_CATALOG.slots, items: summary },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" } }
  );
}

