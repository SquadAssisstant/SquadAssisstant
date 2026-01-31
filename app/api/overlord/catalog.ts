import { GorillaCatalogSchema, type GorillaCatalog } from "./schema";

const CATALOG: GorillaCatalog = {
  version: "2026-01-13",

  unlock: {
    season: 3,
    timingNote: "Unlocked end of Season 2 / beginning of Season 3 (server progression dependent).",
  },

  baseAttributes: ["hp", "def", "atk"],

  assignment: {
    maxSquadsAttached: 1,
    movableBetweenSquads: true,
    effectsOnlyApplyToAttachedSquad: true,
  },

  deployRequirements: {
    requiresAllTrainingAtLeast: 100,
    attributes: ["hp", "def", "atk"],
    note: "Each of HP/DEF/ATK training must reach level 100 before Gorilla can be deployed with a squad.",
  },

  training: {
    attributes: ["hp", "def", "atk"],
    resources: ["trainingCertificates", "trainingGuidebooks"],
    notes: "Training increases Gorilla stats. Some levels require Training Certificates.",
  },

  bond: {
    resources: ["bondBadges"],
    tiers: [
      { name: "New Partner", stagesPerTier: 10 },
      { name: "Rookie Partner", stagesPerTier: 10 },
      { name: "Trusted Friend", stagesPerTier: 10 },
      { name: "Reliable Partner", stagesPerTier: 10 },
      { name: "Loyal Friend", stagesPerTier: 10 },
      { name: "Bonded Partner", stagesPerTier: 10 },
      { name: "Perfect Sync", stagesPerTier: 10, note: "UI shows up to Perfect Sync for you; may extend later." },
    ],
    gatingNote:
      "Bond upgrades require Bond Badges and minimum training thresholds for HP/DEF/ATK before advancing tiers/stages.",
  },

  promotion: {
    resources: ["overlordShards"],
    visibleLevelsNote: "You can see 60 promotion levels; may extend later.",
    stageEveryNLevels: 10,
    notes: "Promotion increases stats and unlocks/advances skills.",
  },

  skills: {
    resources: ["overlordSkillBadges"],
    totalSkillSlots: 5,
    list: [
      { id: "brutal_roar", name: "Brutal Roar", scalable: true, unlock: { note: "Basic skill" } },
      { id: "overlords_armor", name: "Overlord's Armor", scalable: true, unlock: { note: "Basic skill" } },
      { id: "riot_shot", name: "Riot Shot", scalable: true, unlock: { note: "Basic skill" } },
      { id: "furious_hunt", name: "Furious Hunt", scalable: true, unlock: { note: "Unlocks later; you have it unlocked." } },
      { id: "expert_overlord", name: "Expert Overlord", scalable: false, unlock: { note: "Promotion-based unlock (exact level to confirm)." } },
    ],
    notes:
      "Skills are scalable like hero skills; Expert Overlord is treated as a single unlock once obtained (pending confirmation).",
  },

  notes:
    "Overlord effects apply only to the attached squad. Drone component hero buffs can apply to gorilla only when gorilla is unlocked/usable (enforced later in compute).",
};

export const GORILLA_CATALOG = GorillaCatalogSchema.parse(CATALOG);
