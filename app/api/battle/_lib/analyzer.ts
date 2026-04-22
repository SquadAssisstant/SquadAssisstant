function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getHeroGearMultiplier(hero: any): number {
  const pieces = [
    hero?.gear?.weapon,
    hero?.gear?.data_chip,
    hero?.gear?.armor,
    hero?.gear?.radar,
  ].filter(Boolean);

  if (!pieces.length) return 1;

  const totalPower = pieces.reduce((sum: number, p: any) => sum + safeNum(p?.power_bonus), 0);
  const totalAtk = pieces.reduce((sum: number, p: any) => sum + safeNum(p?.atk_bonus), 0);
  const totalDef = pieces.reduce((sum: number, p: any) => sum + safeNum(p?.def_bonus), 0);
  const totalHp = pieces.reduce((sum: number, p: any) => sum + safeNum(p?.hp_bonus), 0);

  const statShape = totalPower + totalAtk * 4 + totalDef * 3 + totalHp * 0.0025;
  return 1 + Math.min(1.0, statShape / 100000);
}

function getHeroPrimarySkillMultiplier(hero: any): number {
  const offensive = (Array.isArray(hero?.skills) ? hero.skills : [])
    .filter((s: any) => (s?.kind === "tactical" || s?.kind === "auto") && safeNum(s?.multiplier_pct) > 0)
    .sort((a: any, b: any) => safeNum(b?.multiplier_pct) - safeNum(a?.multiplier_pct));

  if (offensive[0]) return Math.max(1, safeNum(offensive[0]?.multiplier_pct) / 100);
  return 2.0;
}

function getHeroCombatStats(hero: any) {
  const base = hero?.base_stats || {};
  const weapon = hero?.gear?.weapon;
  const dataChip = hero?.gear?.data_chip;
  const armor = hero?.gear?.armor;
  const radar = hero?.gear?.radar;

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

function scoreHero(hero: any) {
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

export function buildBattleAnalysisFromContext(input: {
  battleReport: any;
  context: {
    heroes: any[];
    drone: any;
    overlord: any;
  };
}) {
  const report = input.battleReport || {};
  const heroes = Array.isArray(input.context.heroes) ? input.context.heroes : [];
  const summarizedHeroes = heroes
    .map((hero) => {
      const stats = getHeroCombatStats(hero);
      return {
        hero_key: hero.hero_key,
        name: hero.name,
        troop_type: hero.troop_type,
        level: hero.level,
        stars: hero.stars,
        stats,
        skill_multiplier: getHeroPrimarySkillMultiplier(hero),
        gear_multiplier: getHeroGearMultiplier(hero),
        score: scoreHero(hero),
      };
    })
    .sort((a, b) => b.score.total - a.score.total);

  const likelyCore = summarizedHeroes.slice(0, 5);
  const lineupMultiplier = getLineupBonusMultiplier(likelyCore);
  const avgMorale = likelyCore.length
    ? likelyCore.reduce((sum, h) => sum + safeNum(h.stats.morale), 0) / likelyCore.length
    : 100;
  const moraleMultiplier = getMoraleMultiplier(avgMorale, 100);

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
  if (input.context.drone?.combat_boost || input.context.drone?.boost_chips || input.context.drone?.components) {
    dominantReasons.push("Saved drone data was included in the combat interpretation.");
  }
  if (input.context.overlord?.profile || input.context.overlord?.skills || input.context.overlord?.promote) {
    dominantReasons.push("Saved overlord data was included in the combat interpretation.");
  }

  return {
    summary: [
      "Battle report analyzer loaded saved player data first, then applied combat-math logic.",
      ...dominantReasons,
      `Top saved heroes by current combat value: ${likelyCore.map((h) => h.name).join(", ") || "none saved"}.`,
    ],
    context_summary: [
      `Saved heroes loaded: ${heroes.length}`,
      `Estimated same-type lineup multiplier: ${lineupMultiplier.toFixed(2)}x`,
      `Estimated morale multiplier: ${moraleMultiplier.toFixed(2)}x`,
    ].join(" • "),
    context: {
      report,
      likely_core_heroes: likelyCore,
      estimated_lineup_multiplier: lineupMultiplier,
      estimated_morale_multiplier: moraleMultiplier,
      drone_ready: !!(input.context.drone?.components || input.context.drone?.combat_boost || input.context.drone?.boost_chips),
      overlord_ready: !!(input.context.overlord?.profile || input.context.overlord?.skills || input.context.overlord?.promote),
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
