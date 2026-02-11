// app/lib/lastwarMath.ts
export type TroopType = "tank" | "air" | "missile";

export type TypeAdvantage = {
  attacker: TroopType;
  defender: TroopType;
  damageDealtMult: number; // 1.2 / 0.8 / 1.0
  damageTakenMult: number; // 0.8 / 1.2 / 1.0
  effectivePowerMult: number; // 1.44 / 0.64 / 1.0 (simplified)
  label: "advantage" | "disadvantage" | "neutral";
};

// Tank → Missile → Air → Tank
export function typeRelation(attacker: TroopType, defender: TroopType): "advantage" | "disadvantage" | "neutral" {
  if (attacker === defender) return "neutral";
  if (attacker === "tank" && defender === "missile") return "advantage";
  if (attacker === "missile" && defender === "air") return "advantage";
  if (attacker === "air" && defender === "tank") return "advantage";
  return "disadvantage";
}

export function getTypeAdvantage(attacker: TroopType, defender: TroopType): TypeAdvantage {
  const rel = typeRelation(attacker, defender);
  if (rel === "neutral") {
    return { attacker, defender, damageDealtMult: 1, damageTakenMult: 1, effectivePowerMult: 1, label: "neutral" };
  }
  if (rel === "advantage") {
    return { attacker, defender, damageDealtMult: 1.2, damageTakenMult: 0.8, effectivePowerMult: 1.44, label: "advantage" };
  }
  return { attacker, defender, damageDealtMult: 0.8, damageTakenMult: 1.2, effectivePowerMult: 0.64, label: "disadvantage" };
}

export type LineupBonus = {
  sameTypeCount: number;
  totalHeroes: number;
  hpAtkDefPct: number; // 0.00, 0.05, 0.10, 0.15, 0.20
  tier: "none" | "3_same" | "3_same_2_diff" | "4_same" | "5_same";
};

export function calcLineupBonus(types: TroopType[]): LineupBonus {
  const totalHeroes = types.length;
  const counts: Record<TroopType, number> = { tank: 0, air: 0, missile: 0 };
  for (const t of types) counts[t]++;

  const sameTypeCount = Math.max(counts.tank, counts.air, counts.missile);

  if (sameTypeCount >= 5) return { sameTypeCount, totalHeroes, hpAtkDefPct: 0.2, tier: "5_same" };
  if (sameTypeCount === 4) return { sameTypeCount, totalHeroes, hpAtkDefPct: 0.15, tier: "4_same" };
  if (sameTypeCount === 3 && totalHeroes === 5) return { sameTypeCount, totalHeroes, hpAtkDefPct: 0.1, tier: "3_same_2_diff" };
  if (sameTypeCount === 3) return { sameTypeCount, totalHeroes, hpAtkDefPct: 0.05, tier: "3_same" };
  return { sameTypeCount, totalHeroes, hpAtkDefPct: 0, tier: "none" };
}

export function heroSetKey(heroIds: (string | null | undefined)[]) {
  return heroIds
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim().toLowerCase())
    .sort()
    .join("|");
}

export function heroOrderKey(heroIdsBySlot: (string | null | undefined)[]) {
  return heroIdsBySlot
    .slice(0, 5)
    .map((x) => (typeof x === "string" && x.trim().length > 0 ? x.trim().toLowerCase() : "_"))
    .join("|");
}
