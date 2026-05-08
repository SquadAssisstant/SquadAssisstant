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

  const droneAttackBonus =
    (hasSavedContextData(drone.combat_boost) ? 45 : 0) +
    (hasSavedContextData(drone.boost_chips) ? 35 : 0);

  const droneBalancedBonus =
    hasSavedContextData(drone.components) ? 30 : 0;

  const overlordAttackBonus =
    hasSavedContextData(overlord.skills) ? 45 : 0;

  const overlordSustainBonus =
    (hasSavedContextData(overlord.promote) ? 30 : 0) +
    (hasSavedContextData(overlord.bond) ? 25 : 0) +
    (hasSavedContextData(overlord.train) ? 25 : 0);

  const base = {
    offence:
      attackWeight +
      droneAttackBonus +
      overlordAttackBonus +
      droneBalancedBonus,
    defense: defenseWeight + overlordSustainBonus + droneBalancedBonus,
    sustain: sustainWeight + overlordSustainBonus + droneBalancedBonus,
    effective_power: powerWeight + droneBalancedBonus,
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
