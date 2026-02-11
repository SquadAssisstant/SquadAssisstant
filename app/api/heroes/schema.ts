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
 * Skills
 * - effects is OPTIONAL and can be added gradually as you learn what each skill does.
 * - scaling numbers are NOT required yet (use "scales" in effects.ts if needed later).
 */
export const HeroSkillSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),

    /**
     * Optional effects (buff/debuff/control/etc.)
     * This is truths-only: what the skill does conceptually, not player-specific numbers.
     */
    effects: z.array(SkillEffectSchema).optional(),

    note: z.string().optional(),
  })
  .strict();
export type HeroSkill = z.infer<typeof HeroSkillSchema>;

/**
 * Hero definition (truths)
 */
export const HeroSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    rarity: HeroRarity,
    type: HeroType,

    // Your known static skill list
    skills: z.array(HeroSkillSchema).min(1),

    /**
     * Optional: extras/passives like Super Sensing / Special Tactics / Field Combat.
     * If you already model this differently, you can remove this block.
     */
    extras: z
      .array(
        z
          .object({
            id: z.string().min(1),
            name: z.string().min(1),

            // Optional effects for passive/extras too.
            effects: z.array(SkillEffectSchema).optional(),

            note: z.string().optional(),
          })
          .strict()
      )
      .optional(),

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
