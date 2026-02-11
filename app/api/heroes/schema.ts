// app/api/heroes/schema.ts
import { z } from "zod";
import { SkillEffectSchema } from "@/app/lib/effects";

/**
 * Compatibility exports (your routes import these names)
 */
export const Rarity = z.enum(["SR", "SSR", "UR"]);
export type Rarity = z.infer<typeof Rarity>;

export const SquadType = z.enum(["tank", "air", "missile"]);
export type SquadType = z.infer<typeof SquadType>;

/**
 * Friendly alias exports (optional use elsewhere)
 */
export const HeroRarity = Rarity;
export type HeroRarity = Rarity;

export const HeroType = SquadType;
export type HeroType = SquadType;

/**
 * Skills
 */
export const HeroSkillType = z.enum(["active", "passive", "ultimate", "special", "unknown"]);
export type HeroSkillType = z.infer<typeof HeroSkillType>;

export const HeroSkillSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),

    // your catalog includes this
    type: HeroSkillType,

    // optional; fill later as you map buffs/debuffs
    effects: z.array(SkillEffectSchema).optional(),

    note: z.string().optional(),
  })
  .strict();
export type HeroSkill = z.infer<typeof HeroSkillSchema>;

/**
 * Promotion rules (matches your catalog objects)
 */
export const PromotionRuleSchema = z
  .object({
    // e.g. season: 1
    season: z.union([z.number().int().positive(), z.literal("unknown")]).optional(),

    fromRarity: Rarity.optional(),
    toRarity: Rarity.optional(),

    // your catalog includes these
    permanentIfChosen: z.boolean().optional(),
    traitReplacesId: z.string().min(1).optional(),
    traitGainedId: z.string().min(1).optional(),

    // your catalog uses `notes` (plural)
    notes: z.string().optional(),

    // allow legacy singular too
    note: z.string().optional(),
  })
  .strict();
export type PromotionRule = z.infer<typeof PromotionRuleSchema>;

/**
 * Hero definition (truths) — matches your existing catalog shape
 */
export const HeroSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    rarity: Rarity,

    // your catalog uses squadType
    squadType: SquadType,

    // allow optional legacy field name
    type: SquadType.optional(),

    // metadata fields your catalog already includes
    primaryRole: z.string().optional(),
    secondaryRoles: z.array(z.string()).optional(),
    damageProfile: z.string().optional(),
    utilityTags: z.array(z.string()).optional(),

    inherentTraitIds: z.array(z.string().min(1)).optional(),

    skills: z.array(HeroSkillSchema).min(1),

    promotionRules: z.array(PromotionRuleSchema).optional(),

    note: z.string().optional(),
  })
  .strict();
export type Hero = z.infer<typeof HeroSchema>;

/**
 * Catalog
 */
export const HeroCatalogSchema = z
  .object({
    version: z.string().min(1),
    heroes: z.array(HeroSchema).min(1),
    notes: z.string().optional(),
  })
  .strict();
export type HeroCatalog = z.infer<typeof HeroCatalogSchema>;
