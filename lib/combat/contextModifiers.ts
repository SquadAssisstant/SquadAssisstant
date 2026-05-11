import { OptimizerMode, PlayerCombatContext } from "@/lib/combat/types";
import { scoreHero } from "@/lib/combat/scoring";
import { HeroRosterEntry } from "@/lib/combat/types";

export function safeContextNumber(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function hasSavedContextData(value: any) {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}
function collectNumbers(value: any): number[] {
  const out: number[] = [];

  function walk(node: any) {
    if (node == null) return;

    if (typeof node === "number") {
      if (Number.isFinite(node)) out.push(node);
      return;
    }

    if (typeof node === "string") {
      const cleaned = node.replace(/[,%]/g, "").trim();
      const n = Number(cleaned);
      if (Number.isFinite(n)) out.push(n);
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }

    if (typeof node === "object") {
      for (const item of Object.values(node)) walk(item);
    }
  }

  walk(value);
  return out;
}

function sumNumbers(value: any, cap = 500) {
  return Math.min(
    cap,
    collectNumbers(value).reduce((sum, n) => sum + n, 0)
  );
}
export function combatContextWeights(
  context: PlayerCombatContext,
  mode: OptimizerMode
) {
  const modifiers = context.modifiers ?? {};

  const attackWeight =
    safeContextNumber(modifiers.attack_flat) * 0.01 +
    safeContextNumber(modifiers.attack_pct) * 12 +
    safeContextNumber(modifiers.damage_pct) * 14 +
    safeContextNumber(modifiers.skill_damage_pct) * 10 +
    safeContextNumber(modifiers.crit_pct) * 8;

  const defenseWeight =
    safeContextNumber(modifiers.defense_flat) * 0.01 +
    safeContextNumber(modifiers.defense_pct) * 12 +
    safeContextNumber(modifiers.damage_reduction_pct) * 14;

  const sustainWeight =
    safeContextNumber(modifiers.hp_flat) * 0.002 +
    safeContextNumber(modifiers.hp_pct) * 10 +
    safeContextNumber(modifiers.march_flat) * 0.002 +
    safeContextNumber(modifiers.march_pct) * 8;

  const powerWeight =
    safeContextNumber(modifiers.power_flat) * 0.01 +
    safeContextNumber(modifiers.power_pct) * 10;

  const drone = context.drone ?? {};
  const overlord = context.overlord ?? {};

  const droneCombatBoostValue = sumNumbers(drone.combat_boost, 700);
const droneBoostChipValue = sumNumbers(drone.boost_chips, 500);
const droneComponentValue = sumNumbers(drone.components, 600);
const droneProfileValue = sumNumbers(drone.profile, 300);

const droneAttackBonus =
  (hasSavedContextData(drone.combat_boost) ? 25 : 0) +
  (hasSavedContextData(drone.boost_chips) ? 20 : 0) +
  droneCombatBoostValue * 0.08 +
  droneBoostChipValue * 0.07;

const droneBalancedBonus =
  (hasSavedContextData(drone.components) ? 18 : 0) +
  droneComponentValue * 0.05 +
  droneProfileValue * 0.03;

const droneSustainBonus =
  droneComponentValue * 0.04 +
  droneProfileValue * 0.025;

  const overlordSkillValue = sumNumbers(overlord.skills, 700);
const overlordPromoteValue = sumNumbers(overlord.promote, 500);
const overlordBondValue = sumNumbers(overlord.bond, 400);
const overlordTrainValue = sumNumbers(overlord.train, 500);
const overlordProfileValue = sumNumbers(overlord.profile, 300);

const overlordAttackBonus =
  (hasSavedContextData(overlord.skills) ? 25 : 0) +
  overlordSkillValue * 0.08 +
  overlordProfileValue * 0.025;

const overlordSustainBonus =
  (hasSavedContextData(overlord.promote) ? 18 : 0) +
  (hasSavedContextData(overlord.bond) ? 15 : 0) +
  (hasSavedContextData(overlord.train) ? 15 : 0) +
  overlordPromoteValue * 0.06 +
  overlordBondValue * 0.05 +
  overlordTrainValue * 0.05 +
  overlordProfileValue * 0.025;

const overlordPowerBonus =
  overlordSkillValue * 0.025 +
  overlordPromoteValue * 0.025 +
  overlordBondValue * 0.02 +
  overlordTrainValue * 0.02 +
  overlordProfileValue * 0.03;

  const base = {
  offence:
    attackWeight +
    droneAttackBonus +
    overlordAttackBonus +
    droneBalancedBonus,
  defense:
    defenseWeight +
    overlordSustainBonus +
    droneBalancedBonus +
    droneSustainBonus,
  sustain:
    sustainWeight +
    overlordSustainBonus +
    droneBalancedBonus +
    droneSustainBonus,
  effective_power:
  powerWeight +
  droneBalancedBonus +
  droneAttackBonus * 0.35 +
  droneSustainBonus * 0.25 +
  overlordPowerBonus,
};

  if (mode === "pure_offence") {
    base.offence *= 1.35;
  }

  if (mode === "pure_defense") {
    base.defense *= 1.35;
    base.sustain *= 1.25;
  }

  if (mode === "offence_leaning_sustain") {
    base.offence *= 1.2;
    base.sustain *= 1.1;
  }

  if (mode === "defense_leaning_sustain") {
    base.defense *= 1.2;
    base.sustain *= 1.2;
  }

  return base;
}

export function contextAdjustedHeroValue(
  hero: HeroRosterEntry,
  context: PlayerCombatContext,
  mode: OptimizerMode
) {
  const s = scoreHero(hero);
  const weights = combatContextWeights(context, mode);

  return (
    s.offence * weights.offence * 0.001 +
    s.defense * weights.defense * 0.001 +
    s.sustain * weights.sustain * 0.0005 +
    s.effective_power * weights.effective_power * 0.001
  );
}
