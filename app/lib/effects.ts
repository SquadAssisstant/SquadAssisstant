// app/lib/effects.ts
import { z } from "zod";

/**
 * Effect keys are game-wide "truths".
 * These are NOT player-specific and do NOT include scaling numbers (yet).
 *
 * Analyzer can count/recognize effect presence.
 * Optimizer later plugs in actual magnitudes/durations when we know them.
 */
export const EffectKey = z.enum([
  // Offense
  "pctAtkUp",
  "pctDamageUp",
  "pctSkillDamageUp",
  "pctCritRateUp",
  "pctCritDamageUp",

  // Defense / sustain
  "pctDefUp",
  "pctHpUp",
  "pctDamageTakenDown",
  "shield",
  "healOverTime",
  "healBurst",

  // Control / debuffs
  "stun",
  "silence",
  "slow",
  "taunt",
  "pctDefDown",
  "pctAtkDown",
  "pctDamageTakenUp",

  // Utility
  "energyGainUp",
  "energyDrain",
  "cleanse",
]);
export type EffectKey = z.infer<typeof EffectKey>;

export const EffectTarget = z.enum(["self", "ally", "allies", "enemy", "enemies", "squad", "global"]);
export type EffectTarget = z.infer<typeof EffectTarget>;

export const EffectStackRule = z.enum([
  "none",        // does not stack; reapplying has no additional effect
  "refresh",     // reapplying refreshes duration
  "stackAdd",    // stacks additively
  "stackMul",    // stacks multiplicatively (rare; keep for future)
  "cap",         // stacks until a cap
]);
export type EffectStackRule = z.infer<typeof EffectStackRule>;

export const SkillEffectSchema = z
  .object({
    key: EffectKey,
    target: EffectTarget,

    // We keep these "scales" friendly — not numeric yet.
    // Optimizer can later replace with real numbers and duration models.
    value: z.union([z.number(), z.literal("scales"), z.null()]).optional(),
    duration: z.union([z.number(), z.literal("scales"), z.null()]).optional(),
    chance: z.union([z.number(), z.literal("scales"), z.null()]).optional(),

    stack: EffectStackRule.optional(),
    note: z.string().optional(),
  })
  .strict();

export type SkillEffect = z.infer<typeof SkillEffectSchema>;

/**
 * Summaries are what Analyzer uses when it can identify heroes (even if it can't identify icons yet).
 * This is intentionally simple: counts per effect key.
 */
export type EffectSummary = {
  byKey: Partial<Record<EffectKey, number>>;
};

export function emptyEffectSummary(): EffectSummary {
  return { byKey: {} };
}

export function addEffect(summary: EffectSummary, effect: SkillEffect) {
  const cur = summary.byKey[effect.key] ?? 0;
  summary.byKey[effect.key] = cur + 1;
}

export function mergeEffectSummaries(a: EffectSummary, b: EffectSummary): EffectSummary {
  const out: EffectSummary = { byKey: { ...a.byKey } };
  for (const [k, v] of Object.entries(b.byKey) as Array<[EffectKey, number]>) {
    out.byKey[k] = (out.byKey[k] ?? 0) + v;
  }
  return out;
}
