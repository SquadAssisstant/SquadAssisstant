// app/api/battle/_lib/analyzer.ts
import { calcLineupBonus, getTypeAdvantage, heroOrderKey, heroSetKey, TroopType } from "@/app/lib/lastwarMath";
import { emptyEffectSummary, addEffect, EffectSummary } from "@/app/lib/effects";

// Import your truths catalog. This must export the catalog object you already have.
// If yours is named HERO_CATALOG, this will work as-is.
import { HERO_CATALOG } from "@/app/api/heroes/catalog";

type ParsedReport = any;
type SideKey = "A" | "B";

export type AnalysisHeroSlot = {
  slotIndex: number; // 1..5
  heroId: string | null;
  type: TroopType | null;
  confidence: number; // 0..1
};

export type AnalysisSide = {
  heroes: AnalysisHeroSlot[]; // always length 5
  heroSetKey: string;
  heroOrderKey: string;

  lineup: {
    sameTypeCount: number;
    totalHeroes: number;
    hpAtkDefPct: number;
    tier: string;
  };

  dominantType: TroopType | null;

  // Buff/debuff math scaffold: counts of effects present in this side's kit.
  effectSummary: EffectSummary;
};

export type BattleAnalysis = {
  ok: true;
  reportId: string;
  sides: Record<SideKey, AnalysisSide>;
  matchup: {
    dominantTypeVs: {
      A_vs_B: null | ReturnType<typeof getTypeAdvantage>;
      B_vs_A: null | ReturnType<typeof getTypeAdvantage>;
    };
  };
  notes: string[];
};

function emptySlots(): AnalysisHeroSlot[] {
  return Array.from({ length: 5 }, (_, i) => ({
    slotIndex: i + 1,
    heroId: null,
    type: null,
    confidence: 0,
  }));
}

function extractHeroes(parsed: ParsedReport, side: SideKey): AnalysisHeroSlot[] {
  const candidates =
    parsed?.analysis?.sides?.[side]?.heroes ??
    parsed?.sides?.[side]?.heroes ??
    parsed?.sides?.[side]?.composition?.heroes ??
    null;

  const slots = emptySlots();
  if (!Array.isArray(candidates)) return slots;

  for (const h of candidates) {
    const idx = Number(h?.slotIndex);
    if (!Number.isFinite(idx) || idx < 1 || idx > 5) continue;

    const heroId = typeof h?.heroId === "string" ? h.heroId : null;
    const type = h?.type === "tank" || h?.type === "air" || h?.type === "missile" ? (h.type as TroopType) : null;

    const conf =
      typeof h?.confidence === "number" && Number.isFinite(h.confidence)
        ? Math.max(0, Math.min(1, h.confidence))
        : heroId || type
          ? 0.6
          : 0;

    slots[idx - 1] = { slotIndex: idx, heroId, type, confidence: conf };
  }

  return slots;
}

function dominantTypeFrom(types: TroopType[]): TroopType | null {
  if (!types.length) return null;
  const counts: Record<TroopType, number> = { tank: 0, air: 0, missile: 0 };
  for (const t of types) counts[t]++;
  const max = Math.max(counts.tank, counts.air, counts.missile);
  if (max === 0) return null;
  if (counts.tank === max) return "tank";
  if (counts.air === max) return "air";
  return "missile";
}

function buildEffectSummaryFromHeroes(heroIds: (string | null)[]): EffectSummary {
  const summary = emptyEffectSummary();

  // Defensive: catalog shape may differ. We only rely on HERO_CATALOG.heroes being an array or map-like.
  const heroes: any[] =
    Array.isArray((HERO_CATALOG as any)?.heroes)
      ? (HERO_CATALOG as any).heroes
      : Array.isArray((HERO_CATALOG as any)?.items)
        ? (HERO_CATALOG as any).items
        : [];

  const byId = new Map<string, any>();
  for (const h of heroes) {
    if (h?.id) byId.set(String(h.id).toLowerCase(), h);
  }

  for (const id of heroIds) {
    if (!id) continue;
    const hero = byId.get(id.toLowerCase());
    if (!hero) continue;

    // Look for skills array with optional effects
    const skills = hero?.skills;
    if (!Array.isArray(skills)) continue;

    for (const s of skills) {
      const effects = s?.effects;
      if (!Array.isArray(effects)) continue;
      for (const e of effects) {
        // e should match SkillEffectSchema if you populate it later
        if (e?.key) addEffect(summary, e);
      }
    }

    // Also allow "passives" or "extras" if you later store them
    const extras = hero?.extras;
    if (Array.isArray(extras)) {
      for (const ex of extras) {
        const effects = ex?.effects;
        if (!Array.isArray(effects)) continue;
        for (const e of effects) {
          if (e?.key) addEffect(summary, e);
        }
      }
    }
  }

  return summary;
}

export function analyzeParsedReport(reportId: string, parsed: ParsedReport): BattleAnalysis {
  const heroesA = extractHeroes(parsed, "A");
  const heroesB = extractHeroes(parsed, "B");

  const heroIdsA = heroesA.map((h) => h.heroId);
  const heroIdsB = heroesB.map((h) => h.heroId);

  const orderKeyA = heroOrderKey(heroIdsA);
  const orderKeyB = heroOrderKey(heroIdsB);

  const setKeyA = heroSetKey(heroIdsA);
  const setKeyB = heroSetKey(heroIdsB);

  const typesA = heroesA.map((h) => h.type).filter((t): t is TroopType => !!t);
  const typesB = heroesB.map((h) => h.type).filter((t): t is TroopType => !!t);

  const lineupA = calcLineupBonus(typesA);
  const lineupB = calcLineupBonus(typesB);

  const domA = dominantTypeFrom(typesA);
  const domB = dominantTypeFrom(typesB);

  const A_vs_B = domA && domB ? getTypeAdvantage(domA, domB) : null;
  const B_vs_A = domA && domB ? getTypeAdvantage(domB, domA) : null;

  // Buff/debuff scaffold: summarized from known hero skills if effects are populated.
  const effectSummaryA = buildEffectSummaryFromHeroes(heroIdsA);
  const effectSummaryB = buildEffectSummaryFromHeroes(heroIdsB);

  const notes: string[] = [];
  if (!setKeyA) notes.push("Side A hero IDs not detected yet (ok for v1).");
  if (!setKeyB) notes.push("Side B hero IDs not detected yet (ok for v1).");
  if (!domA || !domB) notes.push("Dominant troop type could not be determined for at least one side.");
  notes.push("Effect summaries are counts only until skill effects are fully mapped.");

  return {
    ok: true,
    reportId,
    sides: {
      A: {
        heroes: heroesA,
        heroSetKey: setKeyA,
        heroOrderKey: orderKeyA,
        lineup: {
          sameTypeCount: lineupA.sameTypeCount,
          totalHeroes: lineupA.totalHeroes,
          hpAtkDefPct: lineupA.hpAtkDefPct,
          tier: lineupA.tier,
        },
        dominantType: domA,
        effectSummary: effectSummaryA,
      },
      B: {
        heroes: heroesB,
        heroSetKey: setKeyB,
        heroOrderKey: orderKeyB,
        lineup: {
          sameTypeCount: lineupB.sameTypeCount,
          totalHeroes: lineupB.totalHeroes,
          hpAtkDefPct: lineupB.hpAtkDefPct,
          tier: lineupB.tier,
        },
        dominantType: domB,
        effectSummary: effectSummaryB,
      },
    },
    matchup: {
      dominantTypeVs: {
        A_vs_B,
        B_vs_A,
      },
    },
    notes,
  };
}
