import { DroneCatalogSchema, type DroneCatalog } from "./schema";

const CATALOG: DroneCatalog = {
  version: "2026-01-12",

  baseAttributes: ["droneHp", "droneAtk", "droneDef"],

  leveling: {
    inputs: ["pureDroneBattleData", "mixedMechanicalGearsAndDroneBattleData"],
    notes:
      "Drone level increases base HP/ATK/DEF. Leveling requires either pure drone battle data or a mix of mechanical gears + drone battle data (per your notes).",
  },

  components: [
    // Drone-focused components
    {
      id: "drone_component_radar",
      type: "radar",
      name: "Radar",
      upgradeModel: {
        combineUntilLevel: 8,
        researchFromLevel: 8,
        notes: "Up to level 8 combine same-level duplicates into next level. From level 8 onward, progress is research % to next level; points vary by component level used.",
      },
      effects: {
        statAdds: [
          { key: "droneHp", value: 0, scope: "droneOnly", note: "Upgrades drone HP (exact values by level come from player state)." },
        ],
        modifiers: [
          { key: "pctReduceCritTakenChance", value: 0, scope: "droneOnly", note: "Reduces chance of taking critical hits (exact values by level come from player state)." },
        ],
        notes: "Radar upgrades drone HP and reduces chance of taking critical hits.",
      },
    },
    {
      id: "drone_component_thermal_imager",
      type: "thermalImager",
      name: "Thermal Imager",
      upgradeModel: { combineUntilLevel: 8, researchFromLevel: 8 },
      effects: {
        statAdds: [
          { key: "droneDef", value: 0, scope: "droneOnly", note: "Upgrades drone DEF (exact values by level come from player state)." },
        ],
        modifiers: [
          { key: "pctCritRate", value: 0, scope: "droneOnly", note: "Increases crit rate (exact values by level come from player state)." },
        ],
        notes: "Thermal Imager upgrades drone defense and crit rate.",
      },
    },
    {
      id: "drone_component_fuel_cell",
      type: "fuelCell",
      name: "Fuel Cell",
      upgradeModel: { combineUntilLevel: 8, researchFromLevel: 8 },
      effects: {
        statAdds: [
          { key: "droneAtk", value: 0, scope: "droneOnly", note: "Upgrades drone ATK (exact values by level come from player state)." },
        ],
        modifiers: [
          { key: "pctCritDamage", value: 0, scope: "droneOnly", note: "Increases crit damage (exact values by level come from player state)." },
        ],
        notes: "Fuel Cell upgrades drone attack and crit damage.",
      },
    },

    // Hero (and Gorilla when unlocked/usable) focused components
    {
      id: "drone_component_turbo_engine",
      type: "turboEngine",
      name: "Turbo Engine",
      upgradeModel: { combineUntilLevel: 8, researchFromLevel: 8 },
      effects: {
        statAdds: [],
        modifiers: [
          {
            key: "pctHeroHp",
            value: 0,
            scope: "droneAndHeroes",
            note: "Upgrades/boosts hero HP. Gorilla receives this only when unlocked and usable.",
          },
        ],
        notes: "Turbo Engine upgrades hero HP and boosts hero HP (gorilla also benefits when unlocked/usable).",
      },
    },
    {
      id: "drone_component_external_armor",
      type: "externalArmor",
      name: "External Armor",
      upgradeModel: { combineUntilLevel: 8, researchFromLevel: 8 },
      effects: {
        statAdds: [],
        modifiers: [
          {
            key: "pctHeroDef",
            value: 0,
            scope: "droneAndHeroes",
            note: "Upgrades/boosts hero DEF. Gorilla receives this only when unlocked and usable.",
          },
        ],
        notes: "External Armor upgrades hero defense and boosts hero defense (gorilla also benefits when unlocked/usable).",
      },
    },
    {
      id: "drone_component_airborne_missile",
      type: "airborneMissile",
      name: "Airborne Missile",
      upgradeModel: { combineUntilLevel: 8, researchFromLevel: 8 },
      effects: {
        statAdds: [],
        modifiers: [
          {
            key: "pctHeroAtk",
            value: 0,
            scope: "droneAndHeroes",
            note: "Upgrades/boosts hero ATK. Gorilla receives this only when unlocked and usable.",
          },
          {
            key: "pctSkillDamage",
            value: 0,
            scope: "droneAndHeroes",
            note: "Boosts skill damage. Gorilla receives this only when unlocked and usable (if applicable).",
          },
        ],
        notes: "Airborne Missile upgrades hero attack, boosts hero attack, and boosts skill damage (gorilla also benefits when unlocked/usable).",
      },
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
        "Combat Boost unlocks by game stage and is leveled by multiple drone chip types. SSR/UR skill chips behave like gear for heroes (drone-first). SSR skill chips can’t be used to level Combat Boost until using UR chips. Mythic chips exist but behavior is unknown (per your notes).",
    },

    chipSetUnlocks: [
      { atCombatBoostLevel: 10, chipSetIndex: 1, note: "Squad chip set 1 unlocks at Combat Boost level 10." },
      { atCombatBoostLevel: 150, chipSetIndex: 2, note: "Squad chip set 2 unlocks at Combat Boost level 150." },
      { atCombatBoostLevel: 300, chipSetIndex: 3, note: "Squad chip set 3 unlocks at Combat Boost level 300." },
      { atCombatBoostLevel: 450, chipSetIndex: 4, note: "Squad chip set 4 unlocks at Combat Boost level 450." },
    ],

    stageUnlocks: [
      { stage: 1, atCombatBoostLevel: 10, note: "Stage 1 aligns with first squad chip set unlock." },
      { stage: 2, atCombatBoostLevel: 150, note: "Stage 2 aligns with second squad chip set unlock." },
      { stage: 3, atCombatBoostLevel: 300, note: "Stage 3 aligns with third squad chip set unlock." },
      { stage: 4, atCombatBoostLevel: 450, note: "Stage 4 aligns with fourth squad chip set unlock." },
      { stage: 5, atCombatBoostLevel: 600, note: "Stage 5 unlocks at Combat Boost level 600." },
      { stage: 6, atCombatBoostLevel: 750, note: "Stage 6 unlocks at Combat Boost level 750." },
      { stage: 7, atCombatBoostLevel: 900, note: "Stage 7 unlocks at Combat Boost level 900." },
    ],

    effects: {
      statAdds: [
        { key: "droneHp", value: 0, scope: "droneOnly", note: "Combat Boost increases drone HP (exact values depend on level; player-state)." },
        { key: "droneAtk", value: 0, scope: "droneOnly", note: "Combat Boost increases drone ATK (exact values depend on level; player-state)." },
        { key: "droneDef", value: 0, scope: "droneOnly", note: "Combat Boost increases drone DEF (exact values depend on level; player-state)." },
      ],
      modifiers: [
        { key: "pctChipSkillBoost", value: 0, scope: "droneAndHeroes", note: "Combat Boost increases chip skill boost (exact values depend on level; player-state)." },
      ],
      notes: "Combat Boost increases HP/ATK/DEF and chip skill boost (values not hardcoded yet).",
    },
  },

  notes:
    "Drone truths: base attributes, leveling inputs, component list + what each affects, and Combat Boost unlock gates. Gorilla receives relevant component effects only when unlocked (end S2/begin S3) and usable; otherwise drone has no gorilla impact.",
};

export const DRONE_CATALOG = DroneCatalogSchema.parse(CATALOG);
