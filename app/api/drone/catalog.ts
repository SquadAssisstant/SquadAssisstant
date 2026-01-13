import { DroneCatalogSchema, type DroneCatalog } from "./schema";

const CATALOG: DroneCatalog = {
  version: "2026-01-12",

  baseAttributes: ["droneHp", "droneAtk", "droneDef"],

  leveling: {
    inputs: ["pureDroneBattleData", "mixedMechanicalGearsAndDroneBattleData"],
    notes:
      "Drone level increases base HP/ATK/DEF. Requires either pure drone battle data or a mix of mechanical gears + drone battle data (per your notes). Exact curves/caps are player/server dependent and will be added later.",
  },

  components: [
    {
      id: "drone_component_radar",
      type: "radar",
      name: "Radar",
      upgradeModel: { combineUntilLevel: 8, researchFromLevel: 8, notes: "Up to level 8 combine duplicates; after level 8 becomes research % to next level." },
      effects: {
        statAdds: [],
        modifiers: [],
        notes:
          "Component upgrades increase drone + squad heroes (+ gorilla when unlocked). Exact stat amounts vary by level; stored in player-state later.",
      },
    },
    {
      id: "drone_component_turbo_engine",
      type: "turboEngine",
      name: "Turbo Engine",
      upgradeModel: { combineUntilLevel: 8, researchFromLevel: 8 },
      effects: { statAdds: [], modifiers: [], notes: "Affects HP/ATK/DEF and combat modifiers (crit, skill). Exact scaling TBD." },
    },
    {
      id: "drone_component_external_armor",
      type: "externalArmor",
      name: "External Armor",
      upgradeModel: { combineUntilLevel: 8, researchFromLevel: 8 },
      effects: { statAdds: [], modifiers: [], notes: "Affects HP/ATK/DEF and defensive modifiers. Exact scaling TBD." },
    },
    {
      id: "drone_component_thermal_imager",
      type: "thermalImager",
      name: "Thermal Imager",
      upgradeModel: { combineUntilLevel: 8, researchFromLevel: 8 },
      effects: { statAdds: [], modifiers: [], notes: "Affects HP/ATK/DEF and offensive modifiers. Exact scaling TBD." },
    },
    {
      id: "drone_component_fuel_cell",
      type: "fuelCell",
      name: "Fuel Cell",
      upgradeModel: { combineUntilLevel: 8, researchFromLevel: 8 },
      effects: { statAdds: [], modifiers: [], notes: "Affects HP/ATK/DEF and potentially skill damage. Exact scaling TBD." },
    },
    {
      id: "drone_component_airborne_missile",
      type: "airborneMissile",
      name: "Airborne Missile",
      upgradeModel: { combineUntilLevel: 8, researchFromLevel: 8 },
      effects: { statAdds: [], modifiers: [], notes: "Affects HP/ATK/DEF and offensive modifiers (crit/skill). Exact scaling TBD." },
    },
  ],

  combatBoost: {
    rules: {
      leveledBy: [
        "droneDataBasic",
        "droneDataFragment",
        "droneSkillChipSSR",
        "droneSkillChipUR",
        "droneSkillChipMythicUnknown",
      ],
      ssrSkillChipUsageRequiresUrMode: true,
      notes:
        "Combat Boost is leveled by multiple drone data chip types. SSR/UR skill chips behave like gear for heroes (drone-first). SSR skill chips can’t be used to level Combat Boost until using UR chips (per your notes). Mythic chips exist but behavior unknown.",
    },

    chipSetUnlocks: [
      { atCombatBoostLevel: 10, chipSetIndex: 1, note: "Squad chip set 1 unlocks at Combat Boost level 10." },
      { atCombatBoostLevel: 150, chipSetIndex: 2, note: "Squad chip set 2 unlocks at level 150." },
      { atCombatBoostLevel: 300, chipSetIndex: 3, note: "Squad chip set 3 unlocks at level 300." },
      { atCombatBoostLevel: 450, chipSetIndex: 4, note: "Squad chip set 4 unlocks at level 450 (if available)." },
    ],

    stageUnlocks: [
      { stage: 1, atCombatBoostLevel: 10, note: "Stage 1 aligns with first squad chip set unlock." },
      { stage: 2, atCombatBoostLevel: 150, note: "Stage 2 aligns with second squad chip set unlock." },
      { stage: 3, atCombatBoostLevel: 300, note: "Stage 3 aligns with third squad chip set unlock." },
      { stage: 4, atCombatBoostLevel: 450, note: "Stage 4 aligns with fourth squad chip set unlock." },
      { stage: 5, atCombatBoostLevel: 600, note: "Stage 5 unlocks at Combat Boost 600." },
      { stage: 6, atCombatBoostLevel: 750, note: "Stage 6 unlocks at Combat Boost 750." },
      { stage: 7, atCombatBoostLevel: 900, note: "Stage 7 unlocks at Combat Boost 900." },
    ],

    effects: {
      statAdds: [],
      modifiers: [
        { key: "pctChipSkillBoost", value: 0, scope: "droneAndHeroes", note: "Combat Boost increases chip skill boost; exact % depends on level and will be computed from player state later." },
      ],
      notes:
        "Combat Boost increases HP/ATK/DEF and chip skill boost. Exact per-level values are not hardcoded yet; this catalog defines structure and unlock gates.",
    },
  },

  notes:
    "Drone truths: components + combat boost + unlock gates. Exact numeric scaling is intentionally left for later ingestion/verification from your server and player screenshots.",
};

export const DRONE_CATALOG = DroneCatalogSchema.parse(CATALOG);
