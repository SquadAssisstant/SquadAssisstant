import { z } from "zod";

/**
 * Gorilla Overlord – Truths Schema
 * Pure definitions only.
 * No player state, no scaling math.
 */

/* ----------------------------- */
/* Core stat keys                */
/* ----------------------------- */

export const OverlordStatKey = z.enum(["hp", "atk", "def"]);
export type OverlordStatKey = z.infer<typeof OverlordStatKey>;

/* ----------------------------- */
/* Unlock / availability         */
/* ----------------------------- */

export const OverlordUnlockSchema = z.object({
  season: z.number().int().positive(),
  timingNote: z.string().optional(),
}).strict();

/* ----------------------------- */
/* Squad assignment rules        */
/* ----------------------------- */

export const OverlordAssignmentSchema = z.object({
  maxSquadsAttached: z.number().int().positive(),
  movableBetweenSquads: z.boolean(),
  effectsOnlyApplyToAttachedSquad: z.boolean(),
}).strict();

/* ----------------------------- */
/* Training (HP / ATK / DEF)     */
/* ----------------------------- */

export const OverlordTrainingSchema = z.object({
  attributes: z.array(OverlordStatKey).min(1),
  resources: z.array(z.string()).min(1),
  notes: z.string().optional(),
}).strict();

export const OverlordDeployRequirementsSchema = z.object({
  requiresAllTrainingAtLeast: z.number().int().positive(),
  attributes: z.array(OverlordStatKey).min(1),
  note: z.string().optional(),
}).strict();

/* ----------------------------- */
/* Bond / relationship system    */
/* ----------------------------- */

export const OverlordBondTierSchema = z.object({
  name: z.string().min(1),
  stagesPerTier: z.number().int().positive(),
  note: z.string().optional(),
}).strict();

export const OverlordBondSchema = z.object({
  resources: z.array(z.string()).min(1),
  tiers: z.array(OverlordBondTierSchema).min(1),
  gatingNote: z.string().optional(),
}).strict();

/* ----------------------------- */
/* Promotion system              */
/* ----------------------------- */

export const OverlordPromotionSchema = z.object({
  resources: z.array(z.string()).min(1),
  visibleLevelsNote: z.string().optional(),
  stageEveryNLevels: z.number().int().positive(),
  notes: z.string().optional(),
}).strict();

/* ----------------------------- */
/* Skills                        */
/* ----------------------------- */

export const OverlordSkillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  scalable: z.boolean(),
  unlock: z.object({
    note: z.string().optional(),
  }).strict(),
}).strict();

export const OverlordSkillsSchema = z.object({
  resources: z.array(z.string()).min(1),
  totalSkillSlots: z.number().int().positive(),
  list: z.array(OverlordSkillSchema).min(1),
  notes: z.string().optional(),
}).strict();

/* ----------------------------- */
/* Root catalog schema           */
/* ----------------------------- */

export const GorillaCatalogSchema = z.object({
  version: z.string().min(1),

  unlock: OverlordUnlockSchema,

  baseAttributes: z.array(OverlordStatKey).length(3),

  assignment: OverlordAssignmentSchema,

  deployRequirements: OverlordDeployRequirementsSchema,

  training: OverlordTrainingSchema,

  bond: OverlordBondSchema,

  promotion: OverlordPromotionSchema,

  skills: OverlordSkillsSchema,

  notes: z.string().optional(),
}).strict();

export type GorillaCatalog = z.infer<typeof GorillaCatalogSchema>;

