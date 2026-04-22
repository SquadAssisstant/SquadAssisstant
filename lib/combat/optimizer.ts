import {
  AssignedGear,
  FormationSlot,
  GearPiece,
  GearPieceSlot,
  HeroRosterEntry,
  OptimizedSquad,
  OptimizerMode,
  OptimizerResult,
  PlayerCombatContext,
  SquadPlacement,
} from "@/lib/combat/types";
import { getHeroCombatStats, scoreHero, scoreSquad } from "@/lib/combat/scoring";

const FORMATION_ORDER: FormationSlot[] = [1, 2, 3, 4, 5];

function uniqueBy<T>(arr: T[], getKey: (x: T) => string) {
  const map = new Map<string, T>();
  for (const item of arr) map.set(getKey(item), item);
  return Array.from(map.values());
}

function normalizeMode(mode?: string): OptimizerMode {
  switch (String(mode || "").trim()) {
    case "highest_total_power":
    case "pure_offence":
    case "offence_leaning_sustain":
    case "defense_leaning_sustain":
    case "pure_defense":
      return mode as OptimizerMode;
    default:
      return "balanced";
  }
}

function roleForSlot(slot: FormationSlot): "frontline" | "center" | "backline" {
  if (slot === 1 || slot === 2) return "frontline";
  if (slot === 3) return "center";
  return "backline";
}

function sortForFormation(heroes: HeroRosterEntry[], mode: OptimizerMode) {
  return [...heroes].sort((a, b) => {
    const aa = scoreHero(a);
    const bb = scoreHero(b);

    const aFront = aa.sustain + aa.defense * 1.2;
    const bFront = bb.sustain + bb.defense * 1.2;

    const aBack = aa.offence + aa.effective_power * 0.4;
    const bBack = bb.offence + bb.effective_power * 0.4;

    if (mode === "pure_offence") return bBack - aBack;
    if (mode === "pure_defense") return bFront - aFront;

    const aBalanced = aFront * 0.55 + aBack * 0.45;
    const bBalanced = bFront * 0.55 + bBack * 0.45;
    return bBalanced - aBalanced;
  });
}

function buildPlacements(heroes: HeroRosterEntry[], mode: OptimizerMode): SquadPlacement[] {
  const ordered = sortForFormation(heroes, mode);

  const frontliners = [...ordered]
    .sort((a, b) => {
      const aa = scoreHero(a);
      const bb = scoreHero(b);
      return (bb.sustain + bb.defense) - (aa.sustain + aa.defense);
    })
    .slice(0, 2);

  const remaining1 = ordered.filter((h) => !frontliners.some((f) => f.hero_key === h.hero_key));
  const center = remaining1
    .slice()
    .sort((a, b) => {
      const aa = scoreHero(a);
      const bb = scoreHero(b);
      return (bb.total) - (aa.total);
    })[0];

  const remaining2 = remaining1.filter((h) => h.hero_key !== center?.hero_key);
  const backliners = remaining2
    .slice()
    .sort((a, b) => {
      const aa = scoreHero(a);
      const bb = scoreHero(b);
      return (bb.offence + bb.effective_power * 0.4) - (aa.offence + aa.effective_power * 0.4);
    });

  const slotMap = new Map<FormationSlot, HeroRosterEntry>();
  if (frontliners[0]) slotMap.set(1, frontliners[0]);
  if (frontliners[1]) slotMap.set(2, frontliners[1]);
  if (center) slotMap.set(3, center);
  if (backliners[0]) slotMap.set(4, backliners[0]);
  if (backliners[1]) slotMap.set(5, backliners[1]);

  return FORMATION_ORDER.flatMap((slot) => {
    const hero = slotMap.get(slot);
    if (!hero) return [];
    return [
      {
        slot,
        hero_key: hero.hero_key,
        hero_name: hero.name,
        troop_type: hero.troop_type,
        assigned_role: roleForSlot(slot),
        score_note:
          slot <= 2
            ? "Placed forward for sustain and defensive stability."
            : slot === 3
            ? "Placed center for balanced contribution."
            : "Placed rear for stronger damage conversion.",
      },
    ];
  });
}

function flattenOwnedGear(heroes: HeroRosterEntry[]): GearPiece[] {
  const out: GearPiece[] = [];
  for (const hero of heroes) {
    const pieces = [hero.gear.weapon, hero.gear.data_chip, hero.gear.armor, hero.gear.radar].filter(Boolean) as GearPiece[];
    for (const p of pieces) {
      out.push({
        ...p,
        source_hero_key: hero.hero_key,
      });
    }
  }
  return uniqueBy(out, (p) => `${p.slot}:${p.name ?? "unknown"}:${p.stars}:${p.level}:${p.source_hero_key ?? ""}`);
}

function pieceValue(piece: GearPiece, hero: HeroRosterEntry, mode: OptimizerMode) {
  const atk = piece.atk_bonus || 0;
  const def = piece.def_bonus || 0;
  const hp = piece.hp_bonus || 0;
  const power = piece.power_bonus || 0;

  switch (mode) {
    case "highest_total_power":
      return power + atk * 2 + def * 1.5 + hp * 0.001;
    case "pure_offence":
      return atk * 4 + power * 1.5 + hp * 0.0004;
    case "offence_leaning_sustain":
      return atk * 3.3 + def * 1.6 + hp * 0.0009 + power * 1.1;
    case "defense_leaning_sustain":
      return def * 3 + hp * 0.0015 + atk * 1.3 + power;
    case "pure_defense":
      return def * 4 + hp * 0.002 + power * 0.8;
    default:
      return atk * 2.4 + def * 2.1 + hp * 0.0012 + power;
  }
}

function assignBestGearForSquad(
  squadHeroes: HeroRosterEntry[],
  allOwnedGear: GearPiece[],
  mode: OptimizerMode
): AssignedGear[] {
  const used = new Set<string>();
  const assignments: AssignedGear[] = [];

  const bySlot: Record<GearPieceSlot, GearPiece[]> = {
    weapon: allOwnedGear.filter((p) => p.slot === "weapon"),
    data_chip: allOwnedGear.filter((p) => p.slot === "data_chip"),
    armor: allOwnedGear.filter((p) => p.slot === "armor"),
    radar: allOwnedGear.filter((p) => p.slot === "radar"),
  };

  const heroPriority = [...squadHeroes].sort((a, b) => scoreHero(b).total - scoreHero(a).total);

  for (const hero of heroPriority) {
    for (const slot of ["weapon", "data_chip", "armor", "radar"] as GearPieceSlot[]) {
      const candidates = bySlot[slot]
        .filter((p) => !used.has(`${p.slot}:${p.name ?? "unknown"}:${p.level}:${p.stars}:${p.source_hero_key ?? ""}`))
        .sort((a, b) => pieceValue(b, hero, mode) - pieceValue(a, hero, mode));

      const picked = candidates[0] ?? null;
      if (picked) {
        used.add(`${picked.slot}:${picked.name ?? "unknown"}:${picked.level}:${picked.stars}:${picked.source_hero_key ?? ""}`);
      }

      assignments.push({
        hero_key: hero.hero_key,
        slot,
        piece: picked,
        reason: picked
          ? `Assigned best available ${slot.replace("_", " ")} for ${hero.name} under ${mode} weighting.`
          : `No saved ${slot.replace("_", " ")} available for ${hero.name}.`,
      });
    }
  }

  return assignments;
}

function heroReason(hero: HeroRosterEntry, mode: OptimizerMode) {
  const s = scoreHero(hero);
  if (mode === "highest_total_power") return `${hero.name} scored highly on total effective power.`;
  if (mode === "pure_offence") return `${hero.name} scored highly on offence and skill damage conversion.`;
  if (mode === "pure_defense") return `${hero.name} scored highly on defense and frontline sustain.`;
  return `${hero.name} contributed strongly across power, offense, defense, and sustain.`;
}

export function runOptimizer(input: {
  context: PlayerCombatContext;
  mode?: string;
  squadCount?: number;
  lockedHeroes?: string[];
}): OptimizerResult {
  const mode = normalizeMode(input.mode);
  const squadCount = Math.max(1, Math.min(4, Number(input.squadCount || 1)));
  const lockedHeroes = uniqueBy(
    (Array.isArray(input.lockedHeroes) ? input.lockedHeroes : []).map((x) => String(x).trim().toLowerCase()).filter(Boolean),
    (x) => x
  );

  const heroes = uniqueBy(
    input.context.heroes.filter((h) => h.completeness.has_profile),
    (h) => h.hero_key
  );

  const allOwnedGear = flattenOwnedGear(heroes);

  const lockedPool = heroes.filter((h) => lockedHeroes.includes(h.hero_key));
  const freePool = heroes
    .filter((h) => !lockedHeroes.includes(h.hero_key))
    .sort((a, b) => scoreHero(b).total - scoreHero(a).total);

  const used = new Set<string>();
  const squads: OptimizedSquad[] = [];

  let lockedIndex = 0;

  for (let squadNumber = 1; squadNumber <= squadCount; squadNumber++) {
    const squadHeroes: HeroRosterEntry[] = [];

    while (lockedIndex < lockedPool.length && squadHeroes.length < 5) {
      const hero = lockedPool[lockedIndex++];
      if (!used.has(hero.hero_key)) {
        used.add(hero.hero_key);
        squadHeroes.push(hero);
      }
    }

    for (const hero of freePool) {
      if (squadHeroes.length >= 5) break;
      if (used.has(hero.hero_key)) continue;
      used.add(hero.hero_key);
      squadHeroes.push(hero);
    }

    const placements = buildPlacements(squadHeroes, mode);
    const gearAssignments = assignBestGearForSquad(squadHeroes, allOwnedGear, mode);
    const scores = scoreSquad(squadHeroes, mode);

    squads.push({
      squad_number: squadNumber,
      heroes: squadHeroes,
      placements,
      gear_assignments: gearAssignments,
      scores,
      explanation: [
        `Squad ${squadNumber} was built using the ${mode} optimizer mode.`,
        ...squadHeroes.map((h) => heroReason(h, mode)),
        `Formation placement prioritizes front-line sustain, center stability, and rear damage conversion.`,
        `Gear assignment uses the best saved owned gear pool available across all heroes, not only currently equipped gear.`,
      ],
    });
  }

  const unused = heroes
    .filter((h) => !used.has(h.hero_key))
    .map((h) => ({
      hero_key: h.hero_key,
      name: h.name,
      reason:
        "Not selected because the current spread scored lower than the chosen roster under the active optimizer mode.",
    }));

  const assumptions: string[] = [];
  if (!input.context.drone || (!input.context.drone.components && !input.context.drone.combat_boost && !input.context.drone.boost_chips)) {
    assumptions.push("Drone data is incomplete, so optimizer weighted heroes and gear more heavily.");
  }
  if (!input.context.overlord || (!input.context.overlord.profile && !input.context.overlord.skills)) {
    assumptions.push("Overlord data is incomplete, so optimizer could not fully model overlord scaling.");
  }
  if (heroes.some((h) => !h.completeness.has_gear)) {
    assumptions.push("Some heroes are missing saved gear data, so optimizer used best available known gear only.");
  }
  if (heroes.some((h) => !h.completeness.has_skills)) {
    assumptions.push("Some heroes are missing saved skills data, so default skill multipliers were used where needed.");
  }

  return {
    mode,
    squad_count: squadCount,
    locked_heroes: lockedHeroes,
    squads,
    unused_heroes: unused,
    summary: [
      `Optimizer ran in ${mode} mode across ${squadCount} squad${squadCount === 1 ? "" : "s"}.`,
      `Full owned roster was used, not only heroes currently assigned to squads.`,
      `No hero was reused across multiple squads.`,
    ],
    assumptions,
    context_snapshot: {
      hero_count: heroes.length,
      drone_ready: !!(input.context.drone.components || input.context.drone.combat_boost || input.context.drone.boost_chips),
      overlord_ready: !!(input.context.overlord.profile || input.context.overlord.skills || input.context.overlord.promote),
    },
  };
}
