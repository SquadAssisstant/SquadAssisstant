import { getHeroCombatStats, getHeroPrimarySkillMultiplier, getHeroGearMultiplier, scoreHero } from "@/lib/combat/scoring";
import { getLineupBonusMultiplier, getMoraleMultiplier } from "@/lib/combat/mathSpec";

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function summarizeHero(hero: any) {
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
  const summarizedHeroes = heroes.map(summarizeHero).sort((a, b) => b.score.total - a.score.total);

  const likelyCore = summarizedHeroes.slice(0, 5);
  const typeCounts = likelyCore.reduce<Record<string, number>>((acc, h) => {
    acc[h.troop_type || "unknown"] = (acc[h.troop_type || "unknown"] || 0) + 1;
    return acc;
  }, {});
  const bestSameTypeCount = Math.max(...Object.values(typeCounts), 0);
  const lineupMultiplier = getLineupBonusMultiplier(bestSameTypeCount);
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
