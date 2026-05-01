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
  if (typeof v === "string") {
    const cleaned = v.replace(/,/g, "").replace(/%/g, "").trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtNum(v: any) {
  const n = safeNum(v);
  if (!n) return "unknown";
  return Math.round(n).toLocaleString();
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
      return (
        (kind === "tactical" || kind === "auto" || kind === "unknown") &&
        safeNum(s?.multiplier_pct) > 0
      );
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
  const mods = addMods(
    addMods(sumSkillMods(hero), context?.drone?.modifiers),
    context?.overlord?.modifiers
  );

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
  const defense =
    stats.def * gearMult * (1 + safeNum(context?.overlord?.modifiers?.damage_reduction_pct) / 200);
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
      ready: !!(
        context?.overlord?.profile ||
        context?.overlord?.skills ||
        context?.overlord?.promote ||
        context?.overlord?.bond ||
        context?.overlord?.train
      ),
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

function walkValues(input: any, path: string[] = [], out: Array<{ path: string; value: any }> = []) {
  if (input == null) return out;

  if (typeof input !== "object") {
    out.push({ path: path.join(".").toLowerCase(), value: input });
    return out;
  }

  if (Array.isArray(input)) {
    input.forEach((item, idx) => walkValues(item, [...path, String(idx)], out));
    return out;
  }

  for (const [key, value] of Object.entries(input)) {
    walkValues(value, [...path, key], out);
  }

  return out;
}

function findReportNumber(report: any, include: string[], exclude: string[] = []) {
  const rows = walkValues(report);

  for (const row of rows) {
    const p = row.path;
    const matchesInclude = include.some((term) => p.includes(term));
    const matchesExclude = exclude.some((term) => p.includes(term));

    if (!matchesInclude || matchesExclude) continue;

    const n = safeNum(row.value);
    if (n > 0) return n;
  }

  return 0;
}

function findReportText(report: any, include: string[]) {
  const rows = walkValues(report);

  for (const row of rows) {
    const p = row.path;
    if (!include.some((term) => p.includes(term))) continue;

    const s = String(row.value ?? "").trim();
    if (s) return s;
  }

  return "";
}

function inferOutcome(report: any) {
  const text = JSON.stringify(report ?? {}).toLowerCase();

  if (text.includes("victory") || text.includes("win")) return "win";
  if (text.includes("defeat") || text.includes("loss") || text.includes("lost")) return "loss";

  return "unknown";
}

function buildYoursVsTheirs(input: {
  report: any;
  context: any;
  likelyCore: any[];
  factorBreakdown: any;
  lineupMultiplier: number;
  moraleMultiplier: number;
}) {
  const { report, context, likelyCore, factorBreakdown, lineupMultiplier, moraleMultiplier } = input;

  const yourHeroPower = likelyCore.reduce((sum, h) => sum + safeNum(h.stats?.power), 0);
  const yourAttack = likelyCore.reduce((sum, h) => sum + safeNum(h.stats?.atk), 0);
  const yourHp = likelyCore.reduce((sum, h) => sum + safeNum(h.stats?.hp), 0);
  const yourDefense = likelyCore.reduce((sum, h) => sum + safeNum(h.stats?.def), 0);
  const yourMarch = likelyCore.reduce((sum, h) => sum + safeNum(h.stats?.march_size), 0);
  const yourEffectiveValue = likelyCore.reduce((sum, h) => sum + safeNum(h.score?.total), 0);

  const yourGearPower = likelyCore.reduce((sum, h) => {
    const mods = sumGearMods(h.raw_hero);
    return sum + mods.power_flat + mods.attack_flat * 4 + mods.defense_flat * 3 + mods.hp_flat * 0.0025;
  }, 0);

  const yourSkillValue = likelyCore.reduce((sum, h) => {
    return sum + safeNum(h.skill_multiplier) * 1000;
  }, 0);

  const droneMods = factorBreakdown?.drone?.modifiers ?? emptyMods();
  const overlordMods = factorBreakdown?.overlord?.modifiers ?? emptyMods();

  const yourDroneValue =
    droneMods.power_flat +
    droneMods.attack_flat * 4 +
    droneMods.defense_flat * 3 +
    droneMods.hp_flat * 0.0025 +
    droneMods.attack_pct * 500 +
    droneMods.defense_pct * 350 +
    droneMods.hp_pct * 250 +
    droneMods.damage_pct * 750 +
    droneMods.skill_damage_pct * 750;

  const yourOverlordValue =
    overlordMods.power_flat +
    overlordMods.attack_flat * 4 +
    overlordMods.defense_flat * 3 +
    overlordMods.hp_flat * 0.0025 +
    overlordMods.attack_pct * 500 +
    overlordMods.defense_pct * 350 +
    overlordMods.hp_pct * 250 +
    overlordMods.damage_pct * 750 +
    overlordMods.skill_damage_pct * 750;

  const enemyTotalPower =
    findReportNumber(report, ["enemy", "power"]) ||
    findReportNumber(report, ["opponent", "power"]) ||
    findReportNumber(report, ["their", "power"]);

  const yourVisiblePower =
    findReportNumber(report, ["your", "power"]) ||
    findReportNumber(report, ["my", "power"]) ||
    findReportNumber(report, ["attacker", "power"], ["enemy", "opponent", "defender"]) ||
    yourHeroPower;

  const enemyHeroPower =
    findReportNumber(report, ["enemy", "hero", "power"]) ||
    findReportNumber(report, ["opponent", "hero", "power"]);

  const enemyDronePower =
    findReportNumber(report, ["enemy", "drone"]) ||
    findReportNumber(report, ["opponent", "drone"]);

  const enemyOverlordPower =
    findReportNumber(report, ["enemy", "overlord"]) ||
    findReportNumber(report, ["opponent", "overlord"]);

  const enemyAttack =
    findReportNumber(report, ["enemy", "attack"]) ||
    findReportNumber(report, ["opponent", "attack"]) ||
    0;

  const enemyHp =
    findReportNumber(report, ["enemy", "hp"]) ||
    findReportNumber(report, ["opponent", "hp"]) ||
    0;

  const enemyDefense =
    findReportNumber(report, ["enemy", "defense"]) ||
    findReportNumber(report, ["enemy", "def"]) ||
    findReportNumber(report, ["opponent", "defense"]) ||
    findReportNumber(report, ["opponent", "def"]) ||
    0;

  const enemyMarch =
    findReportNumber(report, ["enemy", "march"]) ||
    findReportNumber(report, ["opponent", "march"]) ||
    0;

  const outcome = inferOutcome(report);
  const visibleEnemyEstimate = enemyTotalPower || enemyHeroPower || enemyAttack + enemyHp * 0.0025 + enemyDefense * 3;

  const advantages: string[] = [];
  const disadvantages: string[] = [];
  const outcomeReasons: string[] = [];

  if (yourVisiblePower && enemyTotalPower) {
    if (yourVisiblePower >= enemyTotalPower) {
      advantages.push(`Your visible power was higher: ${fmtNum(yourVisiblePower)} vs ${fmtNum(enemyTotalPower)}.`);
    } else {
      disadvantages.push(`Enemy visible power was higher: ${fmtNum(enemyTotalPower)} vs your ${fmtNum(yourVisiblePower)}.`);
    }
  } else if (enemyTotalPower && !yourVisiblePower) {
    disadvantages.push(`Enemy visible power was detected at ${fmtNum(enemyTotalPower)}, but your visible report power was not detected.`);
  } else if (yourVisiblePower && !enemyTotalPower) {
    advantages.push(`Your saved/visible power was ${fmtNum(yourVisiblePower)}. Enemy total power was not visible, so enemy side is estimated.`);
  }

  if (yourDroneValue > 0 && !enemyDronePower) {
    advantages.push("Your saved drone data was available and applied. Enemy drone details were not visible, so enemy drone impact is estimated.");
  } else if (enemyDronePower && yourDroneValue && enemyDronePower > yourDroneValue) {
    disadvantages.push(`Enemy drone value appeared higher: ${fmtNum(enemyDronePower)} vs your estimated ${fmtNum(yourDroneValue)}.`);
  }

  if (yourOverlordValue > 0 && !enemyOverlordPower) {
    advantages.push("Your saved overlord data was available and applied. Enemy overlord details were not visible, so enemy overlord impact is estimated.");
  } else if (enemyOverlordPower && yourOverlordValue && enemyOverlordPower > yourOverlordValue) {
    disadvantages.push(`Enemy overlord value appeared higher: ${fmtNum(enemyOverlordPower)} vs your estimated ${fmtNum(yourOverlordValue)}.`);
  }

  if (lineupMultiplier > 1) {
    advantages.push(`Your likely squad received an estimated lineup multiplier of ${lineupMultiplier.toFixed(2)}x.`);
  }

  if (moraleMultiplier > 1) {
    advantages.push(`Your saved morale created an estimated morale multiplier of ${moraleMultiplier.toFixed(2)}x.`);
  }

  if (outcome === "loss") {
    outcomeReasons.push("The battle report outcome appears to be a loss.");
    if (disadvantages.length) {
      outcomeReasons.push("The most likely causes are the listed disadvantages above.");
    } else {
      outcomeReasons.push("Enemy hidden bonuses, skill timing, drone/overlord differences, troop losses, or unparsed report stats likely decided the result.");
    }
  } else if (outcome === "win") {
    outcomeReasons.push("The battle report outcome appears to be a win.");
    if (advantages.length) {
      outcomeReasons.push("The most likely causes are the listed advantages above.");
    }
  } else {
    outcomeReasons.push("The battle report outcome was not clearly parsed, so the comparison focuses on visible/saved stat advantages.");
  }

  return {
    outcome,
    yours: {
      visible_power: yourVisiblePower,
      saved_hero_power: yourHeroPower,
      attack: yourAttack,
      hp: yourHp,
      defense: yourDefense,
      march_size: yourMarch,
      gear_value_estimate: yourGearPower,
      skill_value_estimate: yourSkillValue,
      drone_value_estimate: yourDroneValue,
      overlord_value_estimate: yourOverlordValue,
      lineup_multiplier: lineupMultiplier,
      morale_multiplier: moraleMultiplier,
      final_effective_value: yourEffectiveValue,
      source: "saved player data + parsed report when visible",
    },
    theirs: {
      visible_power: enemyTotalPower,
      hero_power: enemyHeroPower,
      attack: enemyAttack,
      hp: enemyHp,
      defense: enemyDefense,
      march_size: enemyMarch,
      drone_power_or_value: enemyDronePower,
      overlord_power_or_value: enemyOverlordPower,
      final_effective_value_estimate: visibleEnemyEstimate,
      source: enemyTotalPower || enemyHeroPower || enemyAttack || enemyHp || enemyDefense
        ? "battle report parsed visible fields"
        : "not visible; estimated from outcome only",
    },
    advantages,
    disadvantages,
    outcome_reasons: outcomeReasons,
    visible_notes: [
      "Your side can use saved hero, gear, skill, drone, overlord, and squad data.",
      "Enemy side can only use values visible in the battle report. Hidden enemy gear, skills, drone chips, overlord bonuses, buffs, debuffs, and multipliers are marked unknown unless visible.",
    ],
  };
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

  const comparison = buildYoursVsTheirs({
    report,
    context,
    likelyCore,
    factorBreakdown,
    lineupMultiplier,
    moraleMultiplier,
  });

  const dominantReasons: string[] = [];

  if (comparison.disadvantages.length) {
    dominantReasons.push(...comparison.disadvantages.slice(0, 3));
  }

  if (comparison.advantages.length) {
    dominantReasons.push(...comparison.advantages.slice(0, 3));
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

  const yoursVsTheirsLines = [
    "Yours vs Theirs:",
    `Outcome detected: ${comparison.outcome}`,
    `Your visible/saved power: ${fmtNum(comparison.yours.visible_power)}`,
    `Enemy visible power: ${fmtNum(comparison.theirs.visible_power)}`,
    `Your final effective value estimate: ${fmtNum(comparison.yours.final_effective_value)}`,
    `Enemy final effective value estimate: ${fmtNum(comparison.theirs.final_effective_value_estimate)}`,
    comparison.advantages.length ? `Your advantages: ${comparison.advantages.join(" ")}` : "Your advantages: none clearly detected.",
    comparison.disadvantages.length ? `Enemy advantages / your disadvantages: ${comparison.disadvantages.join(" ")}` : "Enemy advantages / your disadvantages: none clearly detected.",
  ];

  return {
    summary: [
      "Battle report analyzer loaded saved player data first, then applied combat-math logic.",
      ...yoursVsTheirsLines,
      ...dominantReasons,
      `Top saved heroes by current combat value: ${topHeroLine || "none saved"}.`,
      missingData.length
        ? `Missing/estimated data: ${missingData.slice(0, 4).join(" ")}`
        : "All major saved-data categories were available for the analyzer.",
    ],
    context_summary: [
      `Saved heroes loaded: ${heroes.length}`,
      `Outcome detected: ${comparison.outcome}`,
      `Your effective value: ${fmtNum(comparison.yours.final_effective_value)}`,
      `Enemy visible/estimated value: ${fmtNum(comparison.theirs.final_effective_value_estimate)}`,
      `Drone modifiers: ${factorBreakdown.drone.ready ? "included" : "missing"}`,
      `Overlord modifiers: ${factorBreakdown.overlord.ready ? "included" : "missing"}`,
    ].join(" • "),
    comparison,
    factor_breakdown: factorBreakdown,
    damage_model: {
      likely_core_total_value: likelyCore.reduce((sum, h) => sum + safeNum(h.score.total), 0),
      estimated_lineup_multiplier: lineupMultiplier,
      estimated_morale_multiplier: moraleMultiplier,
      likely_core_heroes: likelyCore,
      yours_vs_theirs: comparison,
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
      comparison,
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
