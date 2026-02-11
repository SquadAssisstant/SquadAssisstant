// app/api/heroes/schema.ts
import { z } from "zod";
import { SkillEffectSchema } from "@/app/lib/effects";

/**
 * Core enums
 */
export const HeroRarity = z.enum(["SR", "SSR", "UR"]);
export type HeroRarity = z.infer<typeof HeroRarity>;

export const HeroType = z.enum(["tank", "air", "missile"]);
export type HeroType = z.infer<typeof HeroType>;

/**
 * Skill type (your catalog already uses this)
 */
export const HeroSkillType = z.enum(["active", "passive", "ultimate", "special", "unknown"]);
export type HeroSkillType = z.infer<typeof HeroSkillType>;

/**
 * Skills
 * - `type` is REQUIRED because your catalog uses it already.
 * - `effects` remains OPTIONAL and can be filled gradually.
 */
export const HeroSkillSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: HeroSkillType,

    /**
     * Optional effects (buff/debuff/control/etc.)
     * truths-only: what the skill does conceptually, not scaling yet
     */
    effects: z.array(SkillEffectSchema).optional(),

    note: z.string().optional(),
  })
  .strict();
export type HeroSkill = z.infer<typeof HeroSkillSchema>;

/**
 * Optional traits / extras / passives like Super Sensing / Special Tactics / Field Combat
 * Your catalog appears to reference inherentTraitIds, so we support that too.
 */
export const HeroExtraSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),

    effects: z.array(SkillEffectSchema).optional(),
    note: z.string().optional(),
  })
  .strict();
export type HeroExtra = z.infer<typeof HeroExtraSchema>;

/**
 * Hero definition (truths)
 */
export const HeroSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    rarity: HeroRarity,
    type: HeroType,

    // Your known static skills
    skills: z.array(HeroSkillSchema).min(1),

    /**
     * If you’re already using traits, keep these:
     * - inherentTraitIds: references to truthy trait definitions
     */
    inherentTraitIds: z.array(z.string().min(1)).optional(),

    /**
     * Optional extras/passives if you store them directly on the hero
     */
    extras: z.array(HeroExtraSchema).optional(),

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
