// lib/drone/skillChipCatalog.ts
import { DroneChipSkill, TroopType } from "./types";

export function defaultChipSkill(
  troop_type: TroopType,
  skill_type: DroneChipSkill["skill_type"],
  name: string,
  description: string
): DroneChipSkill {
  return {
    troop_type,
    skill_type,
    name,
    description,
  };
}

/**
 * Starter defaults based on the screenshots you provided for TANK.
 * Air/Missile can reuse the same structure; only troop_type + names differ.
 */
export function defaultChipSetSkills(troop_type: TroopType) {
  if (troop_type === "tank") {
    return {
      initial_move: defaultChipSkill(
        "tank",
        "initial_move",
        "Absolute Quantum Field (Tank)",
        "At the beginning of the battle, your Tank heroes gain a Shield with a fixed value for 9 seconds. Once it's gone, all damage received is reduced until battle ends."
      ),
      defense: defaultChipSkill(
        "tank",
        "defense",
        "Gravitational Resonance Armor (Tank)",
        "At the beginning of the battle, your Tank heroes gain Defense boost; your front row gains extra Defense boost until battle ends."
      ),
      interference: defaultChipSkill(
        "tank",
        "interference",
        "Memory Ultra Fission (Tank)",
        "When the Drone bombs, your back row Tank heroes get Damage Increase; reduce damage of all enemy Tactics for 3 seconds."
      ),
      offensive: defaultChipSkill(
        "tank",
        "offensive",
        "Lethal Firestorm (Tank)",
        "When the Drone bombs, your Tank heroes gain Attack boost lasting 3 seconds. The drone bombing hits more targets."
      ),
    };
  }

  // For now: generic placeholders (you can rename later in UI without code changes)
  return {
    initial_move: defaultChipSkill(
      troop_type,
      "initial_move",
      `Initial Move Skill (${troop_type.toUpperCase()})`,
      "Describe the initial move effect here (or extract later)."
    ),
    defense: defaultChipSkill(
      troop_type,
      "defense",
      `Defense Skill (${troop_type.toUpperCase()})`,
      "Describe the defense effect here (or extract later)."
    ),
    interference: defaultChipSkill(
      troop_type,
      "interference",
      `Interference Skill (${troop_type.toUpperCase()})`,
      "Describe the interference effect here (or extract later)."
    ),
    offensive: defaultChipSkill(
      troop_type,
      "offensive",
      `Offensive Skill (${troop_type.toUpperCase()})`,
      "Describe the offensive effect here (or extract later)."
    ),
  };
}
