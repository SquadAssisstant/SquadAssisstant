// app/api/heroes/schema.ts
import { z } from "zod";
import { SkillEffectSchema } from "@/app/lib/effects";

/**
 * Keep these export names because your routes already import them.
 */
export const Rarity = z.enum(["SR", "SSR", "UR"]);
export type Rarity = z.infer<typeof Rarity>;

export const SquadType = z.enum(["tank", "air", "missile"]);
export type SquadType = z.infer<typeof SquadType>;

/**
 * Optional aliases (handy elsewhere)
 */
export const HeroRarity = Rarity;
export type HeroRarity = Rarity;

export const HeroType = SquadType;
export type HeroType = SquadType;

/**
 * Skill types (your catalog uses active/passive/etc.)
 */
export const HeroSkillType = z.enum(["active", "passive", "ultimate", "special", "unknown"]);
export type HeroSkillType = z.infer<typeof HeroSkillType>;

/**
 * Skill schema: now supports optional effects
 */
export const HeroSkillSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: HeroSkillType,
    effects: z.array(SkillEffectSchema).optional(),
    note: z.string().optional(),
  })
  .strict();
export type HeroSkill = z.infer<typeof HeroSkillSchema>;

/**
 * Promotion rules: matches what your catalog includes for Mason/Violet/etc.
 */
export const PromotionRuleSchema = z
  .object({
    season: z.union([z.number().int().positive(), z.literal("unknown")]).optional(),
    fromRarity: Rarity.optional(),
    toRarity: Rarity.optional(),

    permanentIfChosen: z.boolean().optional(),
    traitReplacesId: z.string().min(1).optional(),
    traitGainedId: z.string().min(1).optional(),

    // your catalog used `notes` (plural). keep both to be safe.
    notes: z.string().optional(),
    note: z.string().optional(),
  })
  .strict();
export type PromotionRule = z.infer<typeof PromotionRuleSchema>;

/**
 * Trait schema: matches your catalog top-level traits.
 * Example:
 *  { id, name, effect: { stats: { hpPct, atkPct, defPct }, summary } }
 */
export const TraitStatsSchema = z
  .object({
    hpPct: z.number(),
    atkPct: z.number(),
    defPct: z.number(),
  })
  .strict();

export const TraitEffectSchema = z
  .object({
    stats: TraitStatsSchema,
    summary: z.string().min(1),
  })
  .strict();

export const TraitSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    effect: TraitEffectSchema,
    note: z.string().optional(),
  })
  .strict();
export type Trait = z.infer<typeof TraitSchema>;

/**
 * Hero schema: matches your catalog hero objects.
 * NOTE: we keep `squadType` as required because your catalog uses it everywhere.
 */
export const HeroSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    rarity: Rarity,

    squadType: SquadType,

    // metadata fields you already use
    primaryRole: z.string().optional(),
    secondaryRoles: z.array(z.string()).optional(),
    damageProfile: z.string().optional(),
    utilityTags: z.array(z.string()).optional(),

    inherentTraitIds: z.array(z.string().min(1)).optional(),

    skills: z.array(HeroSkillSchema).min(1),

    // can be [] or omitted
    promotionRules: z.array(PromotionRuleSchema).optional(),

    note: z.string().optional(),
  })
  .strict();
export type Hero = z.infer<typeof HeroSchema>;

/**
 * Catalog schema: includes traits + heroes
 */
export const HeroCatalogSchema = z
  .object({
    version: z.string().min(1),
    traits: z.array(TraitSchema).optional(),
    heroes: z.array(HeroSchema).min(1),
    notes: z.string().optional(),
  })
  .strict();

export type HeroCatalog = z.infer<typeof HeroCatalogSchema>;
