// app/api/heroes/schema.ts
import { z } from "zod";

export const Rarity = z.enum(["SR", "SSR", "UR"]);
export const SquadType = z.enum(["tank", "air", "missile"]);

export const MechanicRole = z.enum([
  "damage",
  "tank",
  "healer",
  "buffer",
  "debuffer",
  "control",
  "support",
]);

export const DamageProfile = z.enum([
  "singleTarget",
  "aoe",
  "mixed",
  "dot",
  "burst",
  "unknown",
]);

export const SkillType = z.enum(["active", "passive", "ultimate"]);

export const TraitSchema = z.object({
  id: z.string(),
  name: z.string(),
  effect: z.object({
    stats: z.object({
      hpPct: z.number().optional(),
      atkPct: z.number().optional(),
      defPct: z.number().optional(),
    }),
    summary: z.string(),
  }),
});

export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: SkillType,
  slot: z.number().int().min(1).max(4).optional(),
  notes: z.string().optional(),
});

export const PromotionRuleSchema = z.object({
  toRarity: Rarity,
  season: z.number(),
  permanentIfChosen: z.boolean(),
  traitReplacesId: z.string().optional(),
  traitGainedId: z.string().optional(),
  notes: z.string().optional(),
});

export const HeroSchema = z.object({
  id: z.string(),
  name: z.string(),
  rarity: Rarity,
  squadType: SquadType,

  primaryRole: MechanicRole,
  secondaryRoles: z.array(MechanicRole).default([]),
  damageProfile: DamageProfile.default("unknown"),
  utilityTags: z.array(z.string()).default([]),

  skills: z.array(SkillSchema),
  inherentTraitIds: z.array(z.string()).default([]),
  promotionRules: z.array(PromotionRuleSchema).default([]),
});

export const HeroCatalogSchema = z.object({
  version: z.string(),
  traits: z.array(TraitSchema),
  heroes: z.array(HeroSchema),
});


export type HeroCatalog = z.infer<typeof HeroCatalogSchema>;
