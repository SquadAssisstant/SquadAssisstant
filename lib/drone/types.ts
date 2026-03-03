// lib/drone/types.ts
export type SquadSlot = 1 | 2 | 3 | 4;

export type TroopType = "tank" | "air" | "missile";

export type ChipSkillType =
  | "initial_move"
  | "defense"
  | "interference"
  | "offensive";

export type ChipRarity = "UR" | "SSR" | "SR" | "R" | "N";

export type DroneChipSkill = {
  // Example: "Absolute Quantum Field (Tank)"
  name: string;
  troop_type: TroopType;
  skill_type: ChipSkillType;

  // Display power shown on chip screen (155100, etc.)
  chip_power?: number;

  // Level / stars if you decide to track it later
  level?: number;
  stars?: number;

  // Raw description text (from screenshot or manual input)
  description?: string;

  // Parsed numeric effects you care about (optional now, great later)
  effects?: Record<string, number | string>;
};

export type DroneChipSet = {
  troop_type: TroopType;

  // “Tank Chip Set”, etc.
  label?: string;

  // which squad in your app this chip set is assigned to
  assigned_squad_slot: SquadSlot | null;

  // 4 skills in the set
  skills: {
    initial_move?: DroneChipSkill;
    defense?: DroneChipSkill;
    interference?: DroneChipSkill;
    offensive?: DroneChipSkill;
  };

  // Optional “Squad Power 39.59M” from chip set screen
  displayed_squad_power?: string;

  // Optional screenshot upload(s) that support the values
  source_urls?: string[];

  updated_at?: string;
};

export type DroneCombatBoostState = {
  kind: "drone_combat_boost";
  chip_sets: Record<TroopType, DroneChipSet>;
  saved_at: string;
  source_upload_ids?: number[];
  _history?: Array<{ at: string; value: unknown }>;
};
