export type OptimizerMode =
  | "balanced"
  | "highest_total_power"
  | "pure_offence"
  | "offence_leaning_sustain"
  | "defense_leaning_sustain"
  | "pure_defense";

export type FormationSlot = 1 | 2 | 3 | 4 | 5;

export type TroopType = "tank" | "missile" | "aircraft" | "unknown";

export type CombatStats = {
  hp: number;
  atk: number;
  def: number;
  power: number;
  morale: number;
  march_size: number;
};

export type GearPieceSlot = "weapon" | "data_chip" | "armor" | "radar";

export type GearPiece = {
  id: string;
  slot: GearPieceSlot;
  name: string | null;
  stars: number;
  level: number;
  atk_bonus: number;
  hp_bonus: number;
  def_bonus: number;
  power_bonus: number;
  source_hero_key?: string | null;
};

export type HeroSkill = {
  id: string;
  name: string | null;
  level: number;
  multiplier_pct: number;
  effect_summary: string | null;
  kind: "auto" | "tactical" | "passive" | "unknown";
};

export type HeroRosterEntry = {
  hero_key: string;
  name: string;
  troop_type: TroopType;
  level: number;
  stars: number;
  base_stats: CombatStats;
  profile_upload_id: number | null;
  image_url: string | null;
  raw_profile?: any;
  gear: {
    weapon: GearPiece | null;
    data_chip: GearPiece | null;
    armor: GearPiece | null;
    radar: GearPiece | null;
  };
  skills: HeroSkill[];
  completeness: {
    has_profile: boolean;
    has_gear: boolean;
    has_skills: boolean;
  };
};

export type DroneContext = {
  profile?: any | null;
  components?: any | null;
  combat_boost?: any | null;
  boost_chips?: any | null;
};

export type OverlordContext = {
  profile?: any | null;
  skills?: any | null;
  promote?: any | null;
  bond?: any | null;
  train?: any | null;
};

export type PlayerCombatContext = {
  heroes: HeroRosterEntry[];
  drone: DroneContext;
  overlord: OverlordContext;
  shared_notes: string[];
};

export type SquadPlacement = {
  slot: FormationSlot;
  hero_key: string;
  hero_name: string;
  troop_type: TroopType;
  assigned_role: "frontline" | "center" | "backline";
  score_note: string;
};

export type AssignedGear = {
  hero_key: string;
  slot: GearPieceSlot;
  piece: GearPiece | null;
  reason: string;
};

export type OptimizedSquad = {
  squad_number: number;
  heroes: HeroRosterEntry[];
  placements: SquadPlacement[];
  gear_assignments: AssignedGear[];
  scores: {
    total: number;
    offence: number;
    defense: number;
    sustain: number;
    effective_power: number;
  };
  explanation: string[];
};

export type OptimizerRequest = {
  mode?: OptimizerMode;
  squad_count?: number;
  locked_heroes?: string[];
};

export type OptimizerResult = {
  mode: OptimizerMode;
  squad_count: number;
  locked_heroes: string[];
  squads: OptimizedSquad[];
  unused_heroes: Array<{
    hero_key: string;
    name: string;
    reason: string;
  }>;
  summary: string[];
  assumptions: string[];
  context_snapshot: {
    hero_count: number;
    drone_ready: boolean;
    overlord_ready: boolean;
  };
};
