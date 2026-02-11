// app/api/heroes/schema.ts
import { z } from "zod";
import { SkillEffectSchema } from "@/app/lib/effects";

/**
 * Keep names compatible with your existing imports:
 * - route.ts expects Rarity and SquadType
 */
export const Rarity = z.enum(["SR", "SSR", "UR"]);
export type Rarity = z.infer<typeof Rarity>;

// "SquadType" in your catalog is really the troop type: tank/air/missile
export const SquadType = z.enum(["tank", "air", "missile"]);
export type SquadType = z.infer<typeof SquadType>;

/**
 * Newer internal-friendly names (aliases)
 * (kept so other code can use HeroRarity/HeroType if desired)
 */
export const HeroRarity = Rarity;
export type HeroRarity = Rarity;

export const HeroType = SquadType;
export type HeroType = SquadType;

/**
 * Skill type (your catalog uses this)
 */
export const HeroSkillType = z.enum(["active", "passive", "ultimate", "special", "unknown"]);
export type HeroSkillType = z.infer<typeof HeroSkillType>;

/**
 * Skill schema
 * - includes `type` (active/passive/etc.)
 * - includes optional `effects` for buff/debuff modeling
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
 * Promotion rule schema (keeps your catalog valid)
 * If you currently store promotionRules: [] this will accept it.
 */
export const PromotionRuleSchema = z
  .object({
    season: z.union([z.number().int().positive(), z.literal("unknown")]).optional(),
    fromRarity: Rarity.optional(),
    toRarity: Rarity.optional(),
    note: z.string().optional(),
  })
  .strict();
export type PromotionRule = z.infer<typeof PromotionRuleSchema>;

/**
 * Hero schema matching your existing catalog shape.
 *
 * You currently have:
 *  - squadType
 *  - roles/tags fields
 *  - inherentTraitIds
 *  - skills
 *  - promotionRules
 *
 * We also allow `type` optionally (some older code used type instead of squadType)
 */
export const HeroSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    rarity: Rarity,

    // Your catalog uses squadType: "tank" | "air" | "missile"
    squadType: SquadType,

    // Optional legacy/alternate field name:
    type: SquadType.optional(),

    // Optional metadata you’re already putting in catalog:
    primaryRole: z.string().optional(),
    secondaryRoles: z.array(z.string()).optional(),
    damageProfile: z.string().optional(),
    utilityTags: z.array(z.string()).optional(),

    inherentTraitIds: z.array(z.string().min(1)).optional(),

    skills: z.array(HeroSkillSchema).min(1),

    // Your catalog has promotionRules: [] for many heroes
    promotionRules: z.array(PromotionRuleSchema).optional(),

    note: z.string().optional(),
  })
  .strict();
export type Hero = z.infer<typeof HeroSchema>;

/**
 * Catalog schema
 */
export const HeroCatalogSchema = z
  .object({
    version: z.string().min(1),
    heroes: z.array(HeroSchema).min(1),
    notes: z.string().optional(),
  })
  .strict();
export type HeroCatalog = z.infer<typeof HeroCatalogSchema>;
