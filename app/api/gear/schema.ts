import { z } from "zod";

export const GearSlot = z.enum(["weapon", "armor", "dataChip", "radar"]);
export type GearSlot = z.infer<typeof GearSlot>;

export const GearRarity = z.enum(["SR", "SSR", "UR"]);
export type GearRarity = z.infer<typeof GearRarity>;

export const StatKey = z.enum(["heroAtk", "heroDef", "heroHp"]);
export type StatKey = z.infer<typeof StatKey>;

export const EffectType = z.enum([
  "pctDamageToMonsters",
  "pctReducedDamageFromMonsters",
  "pctCritRate",
  "pctHeroAtkBoost",
  "pctHeroHpBoost",
  "pctHeroDefBoost",
  "pctResistanceAllDamage",
  "pctPhysicalDamageResistance",
  "pctPhysicalDamageReduction",
  "pctEnergyDamageResistance",
]);

export type EffectType = z.infer<typeof EffectType>;

export const EffectSchema = z.object({
  type: EffectType,
  value: z.number(), // percent as 0.025 for 2.5%
  note: z.string().optional(),
}).strict();

export const MilestoneSchema = z.object({
  level: z.number().int().positive(),
  statAdds: z.record(StatKey, z.number()).default({} as any),
  effectsAdd: z.array(EffectSchema).default([]),
  note: z.string().optional(),
}).strict();

export const BlueprintRuleSchema = z.object({
  afterLevel: z.number().int().positive(),
  steps: z.array(
    z.object({
      name: z.string(),
      maxStars: z.number().int().positive(),
      note: z.string().optional(),
    }).strict()
  ),
}).strict();

export const GearItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slot: GearSlot,
  rarity: GearRarity,
  basePower: z.number().int().nonnegative(),
  baseStats: z.record(StatKey, z.number()).default({} as any),
  baseEffects: z.array(EffectSchema).default([]),
  milestones: z.array(MilestoneSchema).default([]),
  blueprintRule: BlueprintRuleSchema.optional(),
  notes: z.string().optional(),
}).strict();

export const GearCatalogSchema = z.object({
  version: z.string().min(1),
  slots: z.array(GearSlot).min(1),
  items: z.array(GearItemSchema).min(1),
}).strict();

export type GearItem = z.infer<typeof GearItemSchema>;
export type GearCatalog = z.infer<typeof GearCatalogSchema>;
