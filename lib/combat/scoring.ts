import { COMBAT_MATH_SPEC, getLineupBonusMultiplier, getMoraleMultiplier } from "@/lib/combat/mathSpec";
import { CombatStats, HeroRosterEntry, OptimizerMode, TroopType } from "@/lib/combat/types";

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function getHeroPrimarySkillMultiplier(hero: HeroRosterEntry): number {
  const offensive = hero.skills
    .filter((s) => (s.kind === "tactical" || s.kind === "auto") && safeNum(s.multiplier_pct) > 0)
    .sort((a, b) => safeNum(b.multiplier_pct) - safeNum(a.multiplier_pct));

  if (offensive[0]) return Math.max(1, safeNum(offensive[0].multiplier_pct) / 100);
  return COMBAT_MATH_SPEC.damage.defaultSkillMultiplier;
}

export function getHeroGearMultiplier(hero: HeroRosterEntry): number {
  const pieces = [hero.gear.weapon, hero.gear.data_chip, hero.gear.armor, hero.gear.radar].filter(Boolean);
  if (!pieces.length) return 1;

  const totalPower = sum(pieces.map((p) => safeNum(p?.power_bonus)));
  const totalAtk = sum(pieces.map((p) => safeNum(p?.atk_bonus)));
  const totalDef = sum(pieces.map((p) => safeNum(p?.def_bonus)));
  const totalHp = sum(pieces.map((p) => safeNum(p?.hp_bonus)));

  const statShape = totalPower + totalAtk * 4 + totalDef * 3 + totalHp * 0.0025;
  return 1 + Math.min(1.0, statShape / 100000);
}

export function getHeroCombatStats(hero: HeroRosterEntry): CombatStats {
  const base = hero.base_stats;
  const weapon = hero.gear.weapon;
  const dataChip = hero.gear.data_chip;
  const armor = hero.gear.armor;
  const radar = hero.gear.radar;

  const atkBonus = safeNum(weapon?.atk_bonus) + safeNum(dataChip?.atk_bonus) + safeNum(armor?.atk_bonus) + safeNum(radar?.atk_bonus);
  const defBonus = safeNum(weapon?.def_bonus) + safeNum(dataChip?.def_bonus) + safeNum(armor?.def_bonus) + safeNum(radar?.def_bonus);
  const hpBonus = safeNum(weapon?.hp_bonus) + safeNum(dataChip?.hp_bonus) + safeNum(armor?.hp_bonus) + safeNum(radar?.hp_bonus);
  const powerBonus =
    safeNum(weapon?.power_bonus) + safeNum(dataChip?.power_bonus) + safeNum(armor?.power_bonus) + safeNum(radar?.power_bonus);

  return {
    hp: safeNum(base.hp) + hpBonus,
    atk: safeNum(base.atk) + atkBonus,
    def: safeNum(base.def) + defBonus,
    power: safeNum(base.power) + powerBonus,
    morale: safeNum(base.morale) || 100,
    march_size: safeNum(base.march_size),
  };
}

export function getSquadTypeCounts(heroes: HeroRosterEntry[]) {
  return heroes.reduce<Record<TroopType, number>>(
    (acc, h) => {
      const t = h.troop_type || "unknown";
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    },
    { tank: 0, missile: 0, aircraft: 0, unknown: 0 }
  );
}

export function getBestTypeLineupMultiplier(heroes: HeroRosterEntry[]) {
  const counts = getSquadTypeCounts(heroes);
  const best = Math.max(counts.tank || 0, counts.missile || 0, counts.aircraft || 0, counts.unknown || 0);
  return getLineupBonusMultiplier(best);
}

export function scoreHero(hero: HeroRosterEntry) {
  const stats = getHeroCombatStats(hero);
  const skillMult = getHeroPrimarySkillMultiplier(hero);
  const gearMult = getHeroGearMultiplier(hero);
  const moraleMult = getMoraleMultiplier(stats.morale, 100);

  const offence = stats.atk * skillMult * gearMult * moraleMult;
  const defense = stats.def * gearMult;
  const sustain = (stats.hp + stats.def * 12) * gearMult;
  const effective_power = stats.power * gearMult * moraleMult;

  return {
    stats,
    offence,
    defense,
    sustain,
    effective_power,
    total:
      offence * 0.9 +
      defense * 0.75 +
      sustain * 0.85 +
      effective_power * 0.65,
  };
}

export function scoreSquad(heroes: HeroRosterEntry[], mode: OptimizerMode) {
  const heroScores = heroes.map(scoreHero);
  const lineupMult = getBestTypeLineupMultiplier(heroes);
  const weights = COMBAT_MATH_SPEC.weightsByMode[mode];

  const rawOffence = sum(heroScores.map((h) => h.offence)) * lineupMult;
  const rawDefense = sum(heroScores.map((h) => h.defense)) * lineupMult;
  const rawSustain = sum(heroScores.map((h) => h.sustain)) * lineupMult;
  const rawEffectivePower = sum(heroScores.map((h) => h.effective_power)) * lineupMult;

  const total =
    rawOffence * weights.offence +
    rawDefense * weights.defense +
    rawSustain * weights.sustain +
    rawEffectivePower * weights.effective_power;

  return {
    total,
    offence: rawOffence,
    defense: rawDefense,
    sustain: rawSustain,
    effective_power: rawEffectivePower,
    lineup_multiplier: lineupMult,
  };
}
