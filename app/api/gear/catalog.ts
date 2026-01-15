import { GearCatalogSchema, type GearCatalog } from "./schema";

const CATALOG: GearCatalog = {
  version: "2026-01-10",
  slots: ["weapon", "armor", "dataChip", "radar"],
  items: [
    // WEAPONS
    {
      id: "weapon_m3_turret",
      name: "M3 Turret",
      slot: "weapon",
      rarity: "SR",
      basePower: 1145,
      baseStats: { heroAtk: 62, heroDef: 10 },
      baseEffects: [],
      milestones: [],
    },
    {
      id: "weapon_m4a_destroyer_cannon",
      name: `M4-A "Destroyer Cannon"`,
      slot: "weapon",
      rarity: "SSR",
      basePower: 5265,
      baseStats: { heroAtk: 192, heroDef: 25 },
      baseEffects: [{ type: "pctDamageToMonsters", value: 0.025 }],
      milestones: [
        { level: 10, effectsAdd: [{ type: "pctDamageToMonsters", value: 0.02 }], statAdds: {} },
        { level: 20, effectsAdd: [{ type: "pctDamageToMonsters", value: 0.02 }], statAdds: {} },
        { level: 30, effectsAdd: [{ type: "pctDamageToMonsters", value: 0.02 }], statAdds: {} },
      ],
    },
    {
      id: "weapon_m5a_thor_railgun",
      name: `M5-A "Thor" Railgun`,
      slot: "weapon",
      rarity: "UR",
      basePower: 31059,
      baseStats: { heroAtk: 895, heroDef: 119 },
      baseEffects: [
        { type: "pctCritRate", value: 0.05 },
        { type: "pctHeroAtkBoost", value: 0.025 },
      ],
      milestones: [
        { level: 10, statAdds: { heroAtk: 250 }, effectsAdd: [] },
        { level: 20, statAdds: {}, effectsAdd: [{ type: "pctCritRate", value: 0.025 }] },
        { level: 30, statAdds: { heroAtk: 250 }, effectsAdd: [] },
        { level: 40, statAdds: {}, effectsAdd: [{ type: "pctCritRate", value: 0.025 }] },
      ],
      blueprintRule: {
        afterLevel: 40,
        steps: [
          { name: "Legendary Blueprints", maxStars: 5 },
          { name: "Mythical Blueprints", maxStars: 5 },
        ],
      },
    },

    // ARMOR
    {
      id: "armor_m3_armor",
      name: "M3 Armor",
      slot: "armor",
      rarity: "SR",
      basePower: 1239,
      baseStats: { heroDef: 10, heroHp: 1749 },
      baseEffects: [],
      milestones: [],
    },
    {
      id: "armor_m4a_porcupine_armor",
      name: `M4-A "Porcupine" Armor`,
      slot: "armor",
      rarity: "SSR",
      basePower: 7100,
      baseStats: { heroHp: 6739, heroDef: 12 },
      baseEffects: [{ type: "pctReducedDamageFromMonsters", value: 0.025 }],
      milestones: [
        { level: 10, effectsAdd: [{ type: "pctReducedDamageFromMonsters", value: 0.02 }], statAdds: {} },
        { level: 20, effectsAdd: [{ type: "pctReducedDamageFromMonsters", value: 0.02 }], statAdds: {} },
        { level: 30, effectsAdd: [{ type: "pctReducedDamageFromMonsters", value: 0.02 }], statAdds: {} },
      ],
    },
    {
      id: "armor_m5a_guard_reactive_armor",
      name: `M5-A "Guard" Reactive Armor`,
      slot: "armor",
      rarity: "UR",
      basePower: 17768,
      baseStats: { heroDef: 59, heroHp: 31355 },
      baseEffects: [
        { type: "pctHeroHpBoost", value: 0.025 },
        { type: "pctHeroDefBoost", value: 0.025 },
      ],
      milestones: [
        { level: 10, statAdds: { heroHp: 21000 }, effectsAdd: [] },
        { level: 20, statAdds: {}, effectsAdd: [{ type: "pctPhysicalDamageResistance", value: 0.1 }] },
        { level: 30, statAdds: { heroHp: 21000 }, effectsAdd: [] },
        { level: 40, statAdds: {}, effectsAdd: [{ type: "pctPhysicalDamageReduction", value: 0.1 }] },
      ],
      blueprintRule: {
        afterLevel: 40,
        steps: [
          { name: "Legendary Blueprints", maxStars: 5 },
          { name: "Mythical Blueprints", maxStars: 5 },
        ],
      },
    },

    // DATA CHIP
    {
      id: "chip_m3_data_chip",
      name: "M3 Data Chip",
      slot: "dataChip",
      rarity: "SR",
      basePower: 1312,
      baseStats: { heroHp: 2642 },
      baseEffects: [],
      milestones: [],
    },
    {
      id: "chip_m4a_jackal_data_chip",
      name: `M4-A "Jackal" Data Chip`,
      slot: "dataChip",
      rarity: "SSR",
      basePower: 4912,
      baseStats: { heroAtk: 128, heroHp: 2695 },
      baseEffects: [{ type: "pctDamageToMonsters", value: 0.025 }],
      milestones: [
        { level: 10, effectsAdd: [{ type: "pctDamageToMonsters", value: 0.02 }], statAdds: {} },
        { level: 20, effectsAdd: [{ type: "pctDamageToMonsters", value: 0.02 }], statAdds: {} },
        { level: 30, effectsAdd: [{ type: "pctDamageToMonsters", value: 0.02 }], statAdds: {} },
      ],
    },
    {
      id: "chip_m5a_hunter_data_chip",
      name: `M5-A "Hunter" Data Chip`,
      slot: "dataChip",
      rarity: "UR",
      basePower: 34736,
      baseStats: { heroAtk: 597, heroHp: 12542 },
      baseEffects: [
        { type: "pctResistanceAllDamage", value: 0.02 },
        { type: "pctHeroAtkBoost", value: 0.025 },
      ],
      milestones: [
        { level: 10, statAdds: { heroAtk: 250 }, effectsAdd: [] },
        { level: 20, statAdds: {}, effectsAdd: [{ type: "pctResistanceAllDamage", value: 0.02 }] },
        { level: 30, statAdds: { heroAtk: 250 }, effectsAdd: [] },
        { level: 40, statAdds: {}, effectsAdd: [{ type: "pctResistanceAllDamage", value: 0.02 }] },
      ],
      blueprintRule: {
        afterLevel: 40,
        steps: [
          { name: "Legendary Blueprints", maxStars: 5 },
          { name: "Mythical Blueprints", maxStars: 5 },
        ],
      },
    },

    // RADAR
    {
      id: "radar_m3_radar",
      name: "M3 Radar",
      slot: "radar",
      rarity: "SR",
      basePower: 520,
      baseStats: { heroAtk: 41 },
      baseEffects: [],
      milestones: [],
    },
    {
      id: "radar_m4a_seahawk_radar",
      name: `M4-A "Seahawk" Radar`,
      slot: "radar",
      rarity: "SSR",
      basePower: 6201,
      baseStats: { heroHp: 4043, heroDef: 25 },
      baseEffects: [{ type: "pctReducedDamageFromMonsters", value: 0.025 }],
      milestones: [
        { level: 10, effectsAdd: [{ type: "pctReducedDamageFromMonsters", value: 0.02 }], statAdds: {} },
        { level: 20, effectsAdd: [{ type: "pctReducedDamageFromMonsters", value: 0.02 }], statAdds: {} },
        { level: 30, effectsAdd: [{ type: "pctReducedDamageFromMonsters", value: 0.02 }], statAdds: {} },
      ],
    },
    {
      id: "radar_m5a_predator_radar",
      name: `M5-A "Predator" Radar`,
      slot: "radar",
      rarity: "UR",
      basePower: 13587,
      baseStats: { heroDef: 119, heroHp: 18813 },
      baseEffects: [
        { type: "pctHeroHpBoost", value: 0.025 },
        { type: "pctHeroDefBoost", value: 0.025 },
      ],
      milestones: [
        { level: 10, statAdds: { heroDef: 100 }, effectsAdd: [] },
        { level: 20, statAdds: {}, effectsAdd: [{ type: "pctEnergyDamageResistance", value: 0.1 }] },
        { level: 30, statAdds: { heroDef: 100 }, effectsAdd: [] },
        { level: 40, statAdds: {}, effectsAdd: [{ type: "pctEnergyDamageResistance", value: 0.1 }] },
      ],
      blueprintRule: {
        afterLevel: 40,
        steps: [
          { name: "Legendary Blueprints", maxStars: 5 },
          { name: "Mythical Blueprints", maxStars: 5 },
        ],
      },
    },
  ],
};

export const GEAR_CATALOG = GearCatalogSchema.parse(CATALOG);
