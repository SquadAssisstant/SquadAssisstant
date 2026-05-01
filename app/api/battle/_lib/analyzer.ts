type StatMods = {
  attack_flat: number;
  attack_pct: number;
  hp_flat: number;
  hp_pct: number;
  defense_flat: number;
  defense_pct: number;
  power_flat: number;
  power_pct: number;
  damage_pct: number;
  damage_reduction_pct: number;
  march_flat: number;
  march_pct: number;
  skill_damage_pct: number;
  crit_pct: number;
};

const emptyMods = (): StatMods => ({
  attack_flat: 0,
  attack_pct: 0,
  hp_flat: 0,
  hp_pct: 0,
  defense_flat: 0,
  defense_pct: 0,
  power_flat: 0,
  power_pct: 0,
  damage_pct: 0,
  damage_reduction_pct: 0,
  march_flat: 0,
  march_pct: 0,
  skill_damage_pct: 0,
  crit_pct: 0,
});

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function addMods(a: StatMods, b: Partial<StatMods> | undefined | null): StatMods {
  const out = { ...a };
  if (!b) return out;
  for (const key of Object.keys(out) as (keyof StatMods)[]) {
    out[key] += safeNum(b[key]);
  }
  return out;
}

function sumGearMods(hero: any): StatMods {
  let mods = emptyMods();

  mods = addMods(mods, hero?.gear_mods);

  for (const piece of [
    hero?.gear?.weapon,
    hero?.gear?.data_chip,
    hero?.gear?.armor,
    hero?.gear?.radar,
  ]) {
    mods = addMods(mods, piece?.mods);

    mods.attack_flat += safeNum(piece?.atk_bonus);
    mods.hp_flat += safeNum(piece?.hp_bonus);
    mods.defense_flat += safeNum(piece?.def_bonus);
    mods.power_flat += safeNum(piece?.power_bonus);
  }

  return mods;
}

function sumSkillMods(hero: any): StatMods {
  let mods = emptyMods();
  mods = addMods(mods, hero?.skill_mods);

  for (const skill of Array.isArray(hero?.skills) ? hero.skills : []) {
    mods = addMods(mods, skill?.mods);
  }

  return mods;
}

function applyMods(base: any, mods: StatMods) {
  const hpBase = safeNum(base.hp);
  const atkBase = safeNum(base.atk);
  const defBase = safeNum(base.def);
  const powerBase = safeNum(base.power);
  const marchBase = safeNum(base.march_size);

  return {
    hp: hpBase * (1 + mods.hp_pct / 100) + mods.hp_flat,
    atk: atkBase * (1 + mods.attack_pct / 100) + mods.attack_flat,
    def: defBase * (1 + mods.defense_pct / 100) + mods.defense_flat,
    power: powerBase * (1 + mods.power_pct / 100) + mods.power_flat,
    morale: safeNum(base.morale) || 100,
    march_size: marchBase * (1 + mods.march_pct / 100) + mods.march_flat,
  };
}

function getHeroGearMultiplier(hero: any): number {
  const mods = sumGearMods(hero);
  const statShape =
    mods.power_flat +
    mods.attack_flat * 4 +
    mods.defense_flat * 3 +
    mods.hp_flat * 0.0025 +
    mods.attack_pct * 500 +
    mods.defense_pct * 350 +
    mods.hp_pct * 250 +
    mods.power_pct * 300;

  return 1 + Math.min(1.0, statShape / 100000);
}

function getHeroPrimarySkillMultiplier(hero: any): number {
  const offensive = (Array.isArray(hero?.skills) ? hero.skills : [])
    .filter((s: any) => {
      const kind = String(s?.kind || "").toLowerCase();
      return (kind === "tactical" || kind === "auto" || kind === "unknown") && safeNum(s?.multiplier_pct) > 0;
    })
    .sort((a: any, b: any) => safeNum(b?.multiplier_pct) - safeNum(a?.multiplier_pct));

  if (offensive[0]) return Math.max(1, safeNum(offensive[0]?.multiplier_pct) / 100);

  const skillMods = sumSkillMods(hero);
  if (skillMods.skill_damage_pct || skillMods.damage_pct) {
    return 1 + Math.max(skillMods.skill_damage_pct, skillMods.damage_pct) / 100;
  }

  return 2.0;
}

function getAllContextMods(context: any): StatMods {
  let mods = emptyMods();
  mods = addMods(mods, context?.drone?.modifiers);
  mods = addMods(mods, context?.overlord?.modifiers);
  return mods;
}

function getHeroCombatStats(hero: any, context?: any) {
  const base = hero?.base_stats || {};

  let mods = emptyMods();
  mods = addMods(mods, sumGearMods(hero));
  mods = addMods(mods, sumSkillMods(hero));
  mods = addMods(mods, getAllContextMods(context));

  return applyMods(base, mods);
}

function getMoraleMultiplier(yourMorale: number, enemyMorale = 100): number {
  const raw = 1 + (yourMorale - enemyMorale) / 100;
  return Math.max(1, Math.min(3, raw));
}

function getLineupBonusMultiplier(heroes: any[]): number {
  const counts = heroes.reduce<Record<string, number>>((acc, h) => {
    const t = String(h?.troop_type || "unknown");
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  const best = Math.max(...Object.values(counts), 0);
  if (best >= 5) return 1.2;
  if (best >= 4) return 1.15;
  if (best >= 3) return 1.05;
  return 1.0;
}

function getDamageModifierMultiplier(hero: any, context: any): number {
  const mods = addMods(addMods(sumSkillMods(hero), context?.drone?.modifiers), context?.overlord?.modifiers);

  const positive = mods.damage_pct + mods.skill_damage_pct + mods.crit_pct * 0.35;
  const reductionPenalty = Math.max(0, mods.damage_reduction_pct) * 0.2;

  return Math.max(0.5, 1 + (positive - reductionPenalty) / 100);
}

function scoreHero(hero: any, context?: any) {
  const stats = getHeroCombatStats(hero, context);
  const skillMult = getHeroPrimarySkillMultiplier(hero);
  const gearMult = getHeroGearMultiplier(hero);
  const moraleMult = getMoraleMultiplier(stats.morale, 100);
  const damageMods = getDamageModifierMultiplier(hero, context);

  const offence = stats.atk * skillMult * gearMult * moraleMult * damageMods;
  const defense = stats.def * gearMult * (1 + safeNum(context?.overlord?.modifiers?.damage_reduction_pct) / 200);
  const sustain = (stats.hp + stats.def * 12) * gearMult;
  const effective_power = stats.power * gearMult * moraleMult;

  return {
    stats,
    offence,
    defense,
    sustain,
    effective_power,
    total: offence * 0.9 + defense * 0.75 + sustain * 0.85 + effective_power * 0.65,
    multipliers: {
      skill: skillMult,
      gear: gearMult,
      morale: moraleMult,
      damage_modifiers: damageMods,
    },
  };
}

function buildFactorBreakdown(context: any, likelyCore: any[]) {
  const droneMods = context?.drone?.modifiers ?? emptyMods();
  const overlordMods = context?.overlord?.modifiers ?? emptyMods();

  const heroLines = likelyCore.map((h) => ({
    name: h.name,
    troop_type: h.troop_type,
    level: h.level,
    stars: h.stars,
    final_stats: h.stats,
    skill_multiplier: h.skill_multiplier,
    gear_multiplier: h.gear_multiplier,
    total_score: h.score.total,
  }));

  return {
    heroes: heroLines,
    gear: likelyCore.map((h) => ({
      hero: h.name,
      modifiers: sumGearMods(h.raw_hero),
    })),
    skills: likelyCore.map((h) => ({
      hero: h.name,
      primary_skill_multiplier: h.skill_multiplier,
      modifiers: sumSkillMods(h.raw_hero),
    })),
    drone: {
      ready: !!(context?.drone?.components || context?.drone?.combat_boost || context?.drone?.boost_chips),
      modifiers: droneMods,
    },
    overlord: {
      ready: !!(context?.overlord?.profile || context?.overlord?.skills || context?.overlord?.promote || context?.overlord?.bond || context?.overlord?.train),
      modifiers: overlordMods,
    },
    squads: Array.isArray(context?.squads) ? context.squads : [],
  };
}

function buildMissingData(context: any) {
  const missing: string[] = [];
  const heroes = Array.isArray(context?.heroes) ? context.heroes : [];

  if (!heroes.length) missing.push("No saved heroes were found.");
  if (!context?.drone?.profile && !context?.drone?.components && !context?.drone?.combat_boost && !context?.drone?.boost_chips) {
    missing.push("No saved drone data was found.");
  }
  if (!context?.overlord?.profile && !context?.overlord?.skills && !context?.overlord?.promote && !context?.overlord?.bond && !context?.overlord?.train) {
    missing.push("No saved overlord data was found.");
  }
  if (!Array.isArray(context?.squads) || !context.squads.length) {
    missing.push("No saved squad assignment facts were found, so likely core heroes are estimated from saved combat value.");
  }

  for (const h of heroes) {
    if (!h?.completeness?.has_profile) missing.push(`${h?.name || h?.hero_key} is missing hero profile data.`);
    if (!h?.completeness?.has_gear) missing.push(`${h?.name || h?.hero_key} is missing hero gear data.`);
    if (!h?.completeness?.has_skills) missing.push(`${h?.name || h?.hero_key} is missing hero skill data.`);
  }

  return missing;
}

export function buildBattleAnalysisFromContext(input: {
  battleReport: any;
  context: { heroes: any[]; drone: any; overlord: any; squads?: any[] };
}) {
  const report = input.battleReport || {};
  const context = input.context || {};
  const heroes = Array.isArray(context.heroes) ? context.heroes : [];

  const summarizedHeroes = heroes
    .map((hero) => {
      const stats = getHeroCombatStats(hero, context);
      const score = scoreHero(hero, context);

      return {
        raw_hero: hero,
        hero_key: hero.hero_key,
        name: hero.name,
        troop_type: hero.troop_type,
        assigned_squad_slot: hero.assigned_squad_slot,
        level: hero.level,
        stars: hero.stars,
        stats,
        skill_multiplier: getHeroPrimarySkillMultiplier(hero),
        gear_multiplier: getHeroGearMultiplier(hero),
        score,
      };
    })
    .sort((a, b) => b.score.total - a.score.total);

  const likelyCore = summarizedHeroes.slice(0, 5);
  const lineupMultiplier = getLineupBonusMultiplier(likelyCore);
  const avgMorale = likelyCore.length
    ? likelyCore.reduce((sum, h) => sum + safeNum(h.stats.morale), 0) / likelyCore.length
    : 100;
  const moraleMultiplier = getMoraleMultiplier(avgMorale, 100);

  const factorBreakdown = buildFactorBreakdown(context, likelyCore);
  const missingData = buildMissingData(context);

  const dominantReasons: string[] = [];

  if (lineupMultiplier > 1) {
    dominantReasons.push(
      `Your saved roster indicates a same-type lineup bonus multiplier of ${lineupMultiplier.toFixed(2)}x for the likely core squad.`
    );
  }

  if (moraleMultiplier > 1) {
    dominantReasons.push(
      `Your saved morale profile suggests an estimated morale damage multiplier of ${moraleMultiplier.toFixed(2)}x.`
    );
  }

  if (factorBreakdown.drone.ready) {
    dominantReasons.push(
      `Saved drone data contributed modifiers including ATK +${safeNum(factorBreakdown.drone.modifiers.attack_pct).toFixed(1)}%, HP +${safeNum(factorBreakdown.drone.modifiers.hp_pct).toFixed(1)}%, DEF +${safeNum(factorBreakdown.drone.modifiers.defense_pct).toFixed(1)}%, and power +${safeNum(factorBreakdown.drone.modifiers.power_flat).toFixed(0)}.`
    );
  }

  if (factorBreakdown.overlord.ready) {
    dominantReasons.push(
      `Saved overlord data contributed modifiers including ATK +${safeNum(factorBreakdown.overlord.modifiers.attack_pct).toFixed(1)}%, HP +${safeNum(factorBreakdown.overlord.modifiers.hp_pct).toFixed(1)}%, DEF +${safeNum(factorBreakdown.overlord.modifiers.defense_pct).toFixed(1)}%, and damage +${safeNum(factorBreakdown.overlord.modifiers.damage_pct).toFixed(1)}%.`
    );
  }

  const topHeroLine = likelyCore
    .map((h) => `${h.name} (${Math.round(h.score.total).toLocaleString()} value)`)
    .join(", ");

  return {
    summary: [
      "Battle report analyzer loaded saved player data first, then applied combat-math logic.",
      ...dominantReasons,
      `Top saved heroes by current combat value: ${topHeroLine || "none saved"}.`,
      missingData.length
        ? `Missing/estimated data: ${missingData.slice(0, 4).join(" ")}`
        : "All major saved-data categories were available for the analyzer.",
    ],
    context_summary: [
      `Saved heroes loaded: ${heroes.length}`,
      `Estimated same-type lineup multiplier: ${lineupMultiplier.toFixed(2)}x`,
      `Estimated morale multiplier: ${moraleMultiplier.toFixed(2)}x`,
      `Drone modifiers: ${factorBreakdown.drone.ready ? "included" : "missing"}`,
      `Overlord modifiers: ${factorBreakdown.overlord.ready ? "included" : "missing"}`,
    ].join(" • "),
    factor_breakdown: factorBreakdown,
    damage_model: {
      likely_core_total_value: likelyCore.reduce((sum, h) => sum + safeNum(h.score.total), 0),
      estimated_lineup_multiplier: lineupMultiplier,
      estimated_morale_multiplier: moraleMultiplier,
      likely_core_heroes: likelyCore,
    },
    reasons: dominantReasons,
    missing_data: missingData,
    context: {
      report,
      likely_core_heroes: likelyCore,
      estimated_lineup_multiplier: lineupMultiplier,
      estimated_morale_multiplier: moraleMultiplier,
      drone_ready: factorBreakdown.drone.ready,
      overlord_ready: factorBreakdown.overlord.ready,
    },
  };
}

export function analyzeParsedReport(input: {
  parsedReport: any;
  context: any;
}) {
  return buildBattleAnalysisFromContext({
    battleReport: input.parsedReport,
    context: input.context,
  });
    }
