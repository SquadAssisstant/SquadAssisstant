import { z } from "zod";

export const StatKey = z.enum(["droneHp", "droneAtk", "droneDef"]);
export type StatKey = z.infer<typeof StatKey>;

export const ModifierKey = z.enum([
  "pctCritRate",
  "pctCritDamage",
  "pctReduceCritTakenChance",
  "pctSkillDamage",
  "pctChipSkillBoost",

  // “Affects heroes + gorilla” is captured as scope, not as separate stat keys.
]);
export type ModifierKey = z.infer<typeof ModifierKey>;

export const EffectScope = z.enum(["droneOnly", "droneAndHeroes", "droneHeroesAndGorilla"]);
export type EffectScope = z.infer<typeof EffectScope>;

export const ModifierSchema = z.object({
  key: ModifierKey,
  value: z.number(), // percent as 0.10 = 10%
  scope: EffectScope,
  note: z.string().optional(),
}).strict();

export const StatAddSchema = z.object({
  key: StatKey,
  value: z.number(), // flat stat add
  scope: EffectScope,
  note: z.string().optional(),
}).strict();

export const DroneComponentType = z.enum([
  "radar",
  "turboEngine",
  "externalArmor",
  "thermalImager",
  "fuelCell",
  "airborneMissile",
]);
export type DroneComponentType = z.infer<typeof DroneComponentType>;

export const ComponentUpgradeModel = z.object({
  combineUntilLevel: z.number().int().positive(), // up to 8: combine duplicates -> next level
  researchFromLevel: z.number().int().positive(), // at/after 8: % research to next level
  notes: z.string().optional(),
}).strict();

export const DroneComponentSchema = z.object({
  id: z.string().min(1),
  type: DroneComponentType,
  name: z.string().min(1),
  upgradeModel: ComponentUpgradeModel,
  effects: z.object({
    statAdds: z.array(StatAddSchema).default([]),
    modifiers: z.array(ModifierSchema).default([]),
    notes: z.string().optional(),
  }).strict(),
}).strict();

export const DroneChipType = z.enum([
  "droneDataBasic",
  "droneDataFragment",
  "droneSkillChipSSR",
  "droneSkillChipUR",
  "droneSkillChipMythicUnknown",
]);
export type DroneChipType = z.infer<typeof DroneChipType>;

export const CombatBoostRulesSchema = z.object({
  leveledBy: z.array(DroneChipType).min(1),
  // Your rule: SSR skill chips can’t be used until you’re using UR chips (we encode as a gate).
  ssrSkillChipUsageRequiresUrMode: z.boolean(),
  notes: z.string().optional(),
}).strict();

export const ChipSetUnlockSchema = z.object({
  atCombatBoostLevel: z.number().int().positive(),
  chipSetIndex: z.number().int().positive(), // 1..4
  note: z.string().optional(),
}).strict();

export const CombatStageUnlockSchema = z.object({
  stage: z.number().int().positive(),
  atCombatBoostLevel: z.number().int().positive(),
  note: z.string().optional(),
}).strict();

export const DroneCatalogSchema = z.object({
  version: z.string().min(1),

  baseAttributes: z.array(StatKey).length(3),

  leveling: z.object({
    // We don’t guess caps; we store mechanics.
    inputs: z.array(z.enum(["pureDroneBattleData", "mixedMechanicalGearsAndDroneBattleData"])).min(1),
    notes: z.string().optional(),
  }).strict(),

  components: z.array(DroneComponentSchema).min(1),

  combatBoost: z.object({
    rules: CombatBoostRulesSchema,
    chipSetUnlocks: z.array(ChipSetUnlockSchema).min(1),
    stageUnlocks: z.array(CombatStageUnlockSchema).min(1),

    // What combat boost affects (structure only)
    effects: z.object({
      statAdds: z.array(StatAddSchema).default([]),
      modifiers: z.array(ModifierSchema).default([]),
      notes: z.string().optional(),
    }).strict(),
  }).strict(),

  notes: z.string().optional(),
}).strict();

export type DroneCatalog = z.infer<typeof DroneCatalogSchema>;
