import { OptimizerMode } from "@/lib/combat/types";

export const COMBAT_MATH_SPEC = {
  typeAdvantage: {
    advantageDamageDealt: 1.2,
    advantageDamageTaken: 0.8,
    disadvantageDamageDealt: 0.8,
    disadvantageDamageTaken: 1.2,
    effectiveSwingAdvantage: 1.44,
    effectiveSwingDisadvantage: 0.64,
  },

  lineupBonus: {
    0: 1.0,
    3: 1.05,
    4: 1.15,
    5: 1.2,
  },

  morale: {
    baseMultiplier: 1.0,
    maxMultiplier: 3.0,
    formula: "1 + (yourMorale - enemyMorale) / 100",
  },

  damage: {
    formula:
      "baseAtk * skillMultiplier * typeAdvantage * moraleBonus * equipmentBonus * setBonus * (1 - enemyDefReduction)",
    defaultEnemyDefReduction: 0.2,
    defaultSkillMultiplier: 2.0,
  },

  warFever: {
    attackBuffFlatPct: 0.01,
    affectsMorale: false,
    durationMinutes: 15,
  },

  weightsByMode: {
    balanced: {
      offence: 1.0,
      defense: 1.0,
      sustain: 1.2,
      effective_power: 0.9,
    },
    highest_total_power: {
      offence: 0.7,
      defense: 0.7,
      sustain: 0.7,
      effective_power: 1.6,
    },
    pure_offence: {
      offence: 1.7,
      defense: 0.35,
      sustain: 0.45,
      effective_power: 0.8,
    },
    offence_leaning_sustain: {
      offence: 1.35,
      defense: 0.7,
      sustain: 1.05,
      effective_power: 0.85,
    },
    defense_leaning_sustain: {
      offence: 0.75,
      defense: 1.2,
      sustain: 1.35,
      effective_power: 0.85,
    },
    pure_defense: {
      offence: 0.35,
      defense: 1.7,
      sustain: 1.2,
      effective_power: 0.8,
    },
  } satisfies Record<OptimizerMode, { offence: number; defense: number; sustain: number; effective_power: number }>,
} as const;

export function clampMoraleMultiplier(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.max(1, Math.min(COMBAT_MATH_SPEC.morale.maxMultiplier, v));
}

export function getTypeModifier(attacker: string, defender: string): number {
  const a = String(attacker || "").toLowerCase();
  const d = String(defender || "").toLowerCase();

  if (a === "tank" && d === "missile") return COMBAT_MATH_SPEC.typeAdvantage.advantageDamageDealt;
  if (a === "missile" && d === "aircraft") return COMBAT_MATH_SPEC.typeAdvantage.advantageDamageDealt;
  if (a === "aircraft" && d === "tank") return COMBAT_MATH_SPEC.typeAdvantage.advantageDamageDealt;

  if (a === "tank" && d === "aircraft") return COMBAT_MATH_SPEC.typeAdvantage.disadvantageDamageDealt;
  if (a === "aircraft" && d === "missile") return COMBAT_MATH_SPEC.typeAdvantage.disadvantageDamageDealt;
  if (a === "missile" && d === "tank") return COMBAT_MATH_SPEC.typeAdvantage.disadvantageDamageDealt;

  return 1.0;
}

export function getLineupBonusMultiplier(countSameType: number): number {
  if (countSameType >= 5) return COMBAT_MATH_SPEC.lineupBonus[5];
  if (countSameType >= 4) return COMBAT_MATH_SPEC.lineupBonus[4];
  if (countSameType >= 3) return COMBAT_MATH_SPEC.lineupBonus[3];
  return COMBAT_MATH_SPEC.lineupBonus[0];
}

export function getMoraleMultiplier(yourMorale: number, enemyMorale = 100): number {
  const raw = 1 + (yourMorale - enemyMorale) / 100;
  return clampMoraleMultiplier(raw);
}
