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
import { contextAdjustedHeroValue, hasSavedContextData } from "@/lib/combat/contextModifiers";

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
function strongestHeroTrait(hero: HeroRosterEntry) {
  const s = scoreHero(hero);

  const traits = [
    { key: "offence", label: "offensive pressure", value: s.offence },
    { key: "defense", label: "defensive stability", value: s.defense },
    { key: "sustain", label: "sustain support", value: s.sustain },
    { key: "effective_power", label: "overall effective power", value: s.effective_power },
  ];

  traits.sort((a, b) => b.value - a.value);
  return traits[0]?.label ?? "balanced contribution";
}

function squadExplanationDetails(
  squadHeroes: HeroRosterEntry[],
  placements: SquadPlacement[],
  mode: OptimizerMode
) {
  const front = placements.filter((p) => p.assigned_role === "frontline");
  const center = placements.find((p) => p.assigned_role === "center");
  const back = placements.filter((p) => p.assigned_role === "backline");

  const scores = squadHeroes.map((h) => scoreHero(h));
  const offenceTotal = scores.reduce((sum, s) => sum + s.offence, 0);
  const defenseTotal = scores.reduce((sum, s) => sum + s.defense, 0);
  const sustainTotal = scores.reduce((sum, s) => sum + s.sustain, 0);

  const troopTypes = Array.from(
    new Set(
      squadHeroes
        .map((h) => String(h.troop_type || "").trim())
        .filter(Boolean)
    )
  );

  const lines: string[] = [];

  if (front.length) {
    lines.push(
      `Frontline uses ${front.map((p) => p.hero_name).join(" and ")} to anchor defensive stability and absorb pressure.`
    );
  }

  if (center) {
    lines.push(
      `${center.hero_name} is placed center because that slot benefits from balanced stat contribution and flexible support.`
    );
  }

  if (back.length) {
    lines.push(
      `Backline uses ${back.map((p) => p.hero_name).join(" and ")} to preserve damage output while the frontline holds.`
    );
  }

  if (troopTypes.length >= 2) {
    lines.push(
      `Troop spread includes ${troopTypes.join(", ")}, improving formation flexibility and reducing overstack risk.`
    );
  }

  if (sustainTotal >= defenseTotal * 0.18) {
    lines.push("Sustain is high enough to support the defensive core instead of relying on raw defense only.");
  }

  if (offenceTotal >= defenseTotal * 0.3) {
    lines.push("Damage output is strong enough that the squad should not stall into a purely defensive lineup.");
  }

  if (mode === "pure_offence") {
    lines.push("Pure offence mode weighted damage conversion and offensive pressure highest.");
  } else if (mode === "pure_defense") {
    lines.push("Pure defense mode weighted frontline durability and sustain highest.");
  } else if (mode === "offence_leaning_sustain") {
    lines.push("Offence-leaning sustain mode favored damage while keeping enough durability to hold formation.");
  } else if (mode === "defense_leaning_sustain") {
    lines.push("Defense-leaning sustain mode favored durability while preserving enough damage to finish fights.");
  } else if (mode === "highest_total_power") {
    lines.push("Highest total power mode prioritized effective power across the full squad.");
  } else {
    lines.push("Balanced mode kept offence, defense, sustain, and effective power in the closest practical balance.");
  }

  return lines;
}
function heroReason(hero: HeroRosterEntry, mode: OptimizerMode) {
  const trait = strongestHeroTrait(hero);

  if (mode === "highest_total_power") {
    return `${hero.name} was selected for ${trait} and high total effective power.`;
  }

  if (mode === "pure_offence") {
    return `${hero.name} was selected for ${trait}, with offence weighted heavily by this mode.`;
  }

  if (mode === "pure_defense") {
    return `${hero.name} was selected for ${trait}, with defense and sustain weighted heavily by this mode.`;
  }

  if (mode === "offence_leaning_sustain") {
    return `${hero.name} was selected for ${trait}, balancing damage with enough sustain to stay useful.`;
  }

  if (mode === "defense_leaning_sustain") {
    return `${hero.name} was selected for ${trait}, supporting a durable squad without dropping damage too far.`;
  }

  return `${hero.name} was selected for ${trait} and balanced squad contribution.`;
}

function heroSelectionValue(hero: HeroRosterEntry, mode: OptimizerMode) {
  const s = scoreHero(hero);

  switch (mode) {
    case "highest_total_power":
      return s.effective_power + s.total * 0.4;

    case "pure_offence":
      return s.offence * 2.5 + s.effective_power * 0.5;

    case "offence_leaning_sustain":
      return (
        s.offence * 1.8 +
        s.sustain * 1.1 +
        s.defense * 0.8 +
        s.effective_power * 0.4
      );

    case "defense_leaning_sustain":
      return (
        s.defense * 1.8 +
        s.sustain * 1.6 +
        s.offence * 0.8 +
        s.effective_power * 0.4
      );

    case "pure_defense":
      return s.defense * 2.3 + s.sustain * 2 + s.effective_power * 0.3;

    case "balanced":
    default:
      return s.total;
  }
}

function heroRoleSelectionValue(
  hero: HeroRosterEntry,
  role: "frontline" | "center" | "backline",
  mode: OptimizerMode
) {
  const s = scoreHero(hero);
  const modeValue = heroSelectionValue(hero, mode);

  if (role === "frontline") {
    return (
      s.defense * 2.2 +
      s.sustain * 2 +
      s.effective_power * 0.4 +
      modeValue * 0.35
    );
  }

  if (role === "center") {
    return (
      s.total * 1.6 +
      s.sustain * 0.8 +
      s.offence * 0.8 +
      s.defense * 0.8 +
      modeValue * 0.4
    );
  }

  return (
    s.offence * 2.4 +
    s.effective_power * 0.6 +
    s.total * 0.4 +
    modeValue * 0.35
  );
}
function squadSynergyValue(heroes: HeroRosterEntry[], mode: OptimizerMode) {
  if (!heroes.length) return 0;

  const scores = heroes.map((h) => scoreHero(h));
  const offenceTotal = scores.reduce((sum, s) => sum + s.offence, 0);
  const defenseTotal = scores.reduce((sum, s) => sum + s.defense, 0);
  const sustainTotal = scores.reduce((sum, s) => sum + s.sustain, 0);
  const powerTotal = scores.reduce((sum, s) => sum + s.effective_power, 0);

  const troopCounts = new Map<string, number>();
  for (const hero of heroes) {
    const troop = String(hero.troop_type || "unknown").toLowerCase();
    troopCounts.set(troop, (troopCounts.get(troop) ?? 0) + 1);
  }

  const knownTroopTypes = [...troopCounts.keys()].filter((t) => t !== "unknown");
  const troopDiversityBonus = knownTroopTypes.length >= 2 ? knownTroopTypes.length * 35 : 0;

  const duplicateTroopPenalty = [...troopCounts.entries()].reduce((sum, [troop, count]) => {
    if (troop === "unknown") return sum;
    return count > 3 ? sum + (count - 3) * 45 : sum;
  }, 0);

  const hasFrontlineCore = heroes.length < 2 || defenseTotal >= offenceTotal * 0.42;
  const frontlinePenalty = hasFrontlineCore ? 0 : 160;

  const hasDamageCore = heroes.length < 4 || offenceTotal >= defenseTotal * 0.3;
  const damagePenalty = hasDamageCore ? 0 : 130;

  const sustainToDefenseRatio = defenseTotal > 0 ? sustainTotal / defenseTotal : 0;
  const sustainSupportBonus = sustainToDefenseRatio >= 0.18 ? Math.min(180, sustainTotal * 0.04) : 0;

  const balancedCoreBonus =
    offenceTotal > 0 && defenseTotal > 0 && sustainTotal > 0
      ? Math.min(offenceTotal, defenseTotal, sustainTotal) * 0.035
      : 0;

  let modeBonus = 0;

  if (mode === "pure_offence") {
    modeBonus = offenceTotal * 0.035 - defenseTotal * 0.004;
  } else if (mode === "pure_defense") {
    modeBonus = defenseTotal * 0.035 + sustainTotal * 0.025 - offenceTotal * 0.004;
  } else if (mode === "offence_leaning_sustain") {
    modeBonus = offenceTotal * 0.025 + sustainTotal * 0.02;
  } else if (mode === "defense_leaning_sustain") {
    modeBonus = defenseTotal * 0.025 + sustainTotal * 0.025;
  } else if (mode === "highest_total_power") {
    modeBonus = powerTotal * 0.02;
  } else {
    modeBonus = balancedCoreBonus;
  }

  return (
    troopDiversityBonus +
    sustainSupportBonus +
    balancedCoreBonus +
    modeBonus -
    duplicateTroopPenalty -
    frontlinePenalty -
    damagePenalty
  );
}
function squadCandidateValue(
  currentSquad: HeroRosterEntry[],
  candidate: HeroRosterEntry,
  mode: OptimizerMode,
  context: PlayerCombatContext
) {
  const nextSquad = [...currentSquad, candidate];

  const squadScore = scoreSquad(nextSquad, mode);
  const candidateScore = scoreHero(candidate);
  const contextValue = contextAdjustedHeroValue(candidate, context, mode);
  const synergyValue = squadSynergyValue(nextSquad, mode);

  const troopTypes = new Set(
    nextSquad.map((h) => h.troop_type).filter(Boolean)
  );

  const troopDiversityBonus = troopTypes.size * 25;

  const sustainTotal = nextSquad.reduce(
    (sum, h) => sum + scoreHero(h).sustain,
    0
  );

  const offenceTotal = nextSquad.reduce(
    (sum, h) => sum + scoreHero(h).offence,
    0
  );

  const defenseTotal = nextSquad.reduce(
    (sum, h) => sum + scoreHero(h).defense,
    0
  );

  const weakFrontlinePenalty =
    nextSquad.length >= 2 && defenseTotal < offenceTotal * 0.45
      ? 150
      : 0;

  const lowDamagePenalty =
    nextSquad.length >= 4 && offenceTotal < defenseTotal * 0.35
      ? 120
      : 0;

  const sustainBonus =
    sustainTotal > 0
      ? Math.min(200, sustainTotal * 0.08)
      : 0;

  return (
  squadScore.total +
  candidateScore.total * 0.35 +
  contextValue +
  synergyValue +
  troopDiversityBonus +
  sustainBonus -
  weakFrontlinePenalty -
  lowDamagePenalty
);
}
function optimizedSquadValue(
  heroes: HeroRosterEntry[],
  mode: OptimizerMode,
  context: PlayerCombatContext
) {
  const squadScore = scoreSquad(heroes, mode);
  const synergy = squadSynergyValue(heroes, mode);
  const contextValue = heroes.reduce(
    (sum, hero) => sum + contextAdjustedHeroValue(hero, context, mode),
    0
  );

  return squadScore.total + synergy + contextValue;
}

function improveSquadWithUnusedHeroes(
  squadHeroes: HeroRosterEntry[],
  unusedHeroes: HeroRosterEntry[],
  mode: OptimizerMode,
  context: PlayerCombatContext
) {
  const improved = [...squadHeroes];
  const remainingUnused = [...unusedHeroes];

  let changed = true;
  let passes = 0;

  while (changed && passes < 2) {
    changed = false;
    passes++;

    let bestGain = 0;
    let bestSquadIndex = -1;
    let bestUnusedIndex = -1;
    let bestCandidateSquad: HeroRosterEntry[] | null = null;

    const currentValue = optimizedSquadValue(improved, mode, context);

    for (let squadIndex = 0; squadIndex < improved.length; squadIndex++) {
      for (
        let unusedIndex = 0;
        unusedIndex < remainingUnused.length;
        unusedIndex++
      ) {
        const candidateSquad = [...improved];
        candidateSquad[squadIndex] = remainingUnused[unusedIndex];

        const candidateValue = optimizedSquadValue(
          candidateSquad,
          mode,
          context
        );

        const gain = candidateValue - currentValue;

        if (gain > bestGain) {
          bestGain = gain;
          bestSquadIndex = squadIndex;
          bestUnusedIndex = unusedIndex;
          bestCandidateSquad = candidateSquad;
        }
      }
    }

    if (
      bestCandidateSquad &&
      bestSquadIndex >= 0 &&
      bestUnusedIndex >= 0 &&
      bestGain > 25
    ) {
      const removedHero = improved[bestSquadIndex];
      const addedHero = remainingUnused[bestUnusedIndex];

      improved[bestSquadIndex] = addedHero;
      remainingUnused[bestUnusedIndex] = removedHero;

      changed = true;
    }
  }

  return {
    heroes: improved,
    unused: remainingUnused,
  };
}
function optimizerParityAudit(context: PlayerCombatContext) {
  const notes: string[] = [];

  const hasHeroes = Array.isArray(context.heroes) && context.heroes.length > 0;
  const hasDrone = !!(
    context.drone?.profile ||
    context.drone?.components ||
    context.drone?.combat_boost ||
    context.drone?.boost_chips
  );
  const hasOverlord = !!(
    context.overlord?.profile ||
    context.overlord?.skills ||
    context.overlord?.promote ||
    context.overlord?.bond ||
    context.overlord?.train
  );
  const hasSharedModifiers = !!(
    context.modifiers && Object.keys(context.modifiers).length > 0
  );

  if (hasHeroes) {
    notes.push("Hero profile, gear, and skill context is available to optimizer.");
  } else {
    notes.push("Hero context is missing, so optimizer cannot match analyzer inputs.");
  }

  if (hasDrone) {
    notes.push("Drone context is available and included through shared modifier weighting.");
  } else {
    notes.push("Drone context is missing or incomplete compared with battle analyzer expectations.");
  }

  if (hasOverlord) {
    notes.push("Overlord context is available and included through shared modifier weighting.");
  } else {
    notes.push("Overlord context is missing or incomplete compared with battle analyzer expectations.");
  }

  if (hasSharedModifiers) {
    notes.push("Shared combat modifiers are present and used by optimizer weighting.");
  } else {
    notes.push("Shared combat modifiers are not present, so optimizer relies on saved hero/drone/overlord data only.");
  }

  if (Array.isArray(context.shared_notes) && context.shared_notes.length) {
    notes.push(...context.shared_notes.map((note) => `Shared note: ${note}`));
  }

  return notes;
}
export function runOptimizer(input: {
  context: PlayerCombatContext;
  mode?: string;
  squadModes?: string[];
  squadCount?: number;
  lockedHeroes?: string[];
}): OptimizerResult {
  const mode = normalizeMode(input.mode);
  const squadModes = Array.isArray(input.squadModes)
    ? input.squadModes.map((m) => normalizeMode(m))
    : [];
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
  const freePool = heroes.filter((h) => !lockedHeroes.includes(h.hero_key));

  const used = new Set<string>();
  const squads: OptimizedSquad[] = [];

  let lockedIndex = 0;

  for (let squadNumber = 1; squadNumber <= squadCount; squadNumber++) {
  const squadMode = squadModes[squadNumber - 1] ?? mode;
  const squadHeroes: HeroRosterEntry[] = [];

    while (lockedIndex < lockedPool.length && squadHeroes.length < 5) {
      const hero = lockedPool[lockedIndex++];
      if (!used.has(hero.hero_key)) {
        used.add(hero.hero_key);
        squadHeroes.push(hero);
      }
    }

    while (squadHeroes.length < 5) {
  const targetSlot = FORMATION_ORDER[squadHeroes.length];
  const targetRole = roleForSlot(targetSlot);

  const candidate = freePool
    .filter((h) => !used.has(h.hero_key))
    .sort((a, b) => {
  const aRole = heroRoleSelectionValue(a, targetRole, squadMode);
  const bRole = heroRoleSelectionValue(b, targetRole, squadMode);

  const aSquad = squadCandidateValue(squadHeroes, a, squadMode, input.context);
const bSquad = squadCandidateValue(squadHeroes, b, squadMode, input.context);

  return (bRole + bSquad) - (aRole + aSquad);
})[0];

  if (!candidate) break;

  used.add(candidate.hero_key);
  squadHeroes.push(candidate);
    }

    const placements = buildPlacements(squadHeroes, squadMode);
const gearAssignments = assignBestGearForSquad(squadHeroes, allOwnedGear, squadMode);
const scores = scoreSquad(squadHeroes, squadMode);

    squads.push({
      squad_number: squadNumber,
      heroes: squadHeroes,
      placements,
      gear_assignments: gearAssignments,
      scores,
      explanation: [
  `Squad ${squadNumber} was built using the ${squadMode} optimizer mode.`,
  ...squadExplanationDetails(squadHeroes, placements, squadMode),
  ...squadHeroes.map((h) => heroReason(h, squadMode)),
  `Gear assignment uses the best saved owned gear pool available across all heroes, not only currently equipped gear.`,
],
    });
  }
let postPassUnused = heroes.filter((h) => !squads.some((s) => s.heroes.some((sh) => sh.hero_key === h.hero_key)));

for (let i = 0; i < squads.length; i++) {
  const squad = squads[i];
  const squadMode = squadModes[squad.squad_number - 1] ?? mode;

  const improved = improveSquadWithUnusedHeroes(
    squad.heroes,
    postPassUnused,
    squadMode,
    input.context
  );

  postPassUnused = improved.unused;

  const placements = buildPlacements(improved.heroes, squadMode);
  const gearAssignments = assignBestGearForSquad(improved.heroes, allOwnedGear, squadMode);
  const scores = scoreSquad(improved.heroes, squadMode);

  squads[i] = {
    ...squad,
    heroes: improved.heroes,
    placements,
    gear_assignments: gearAssignments,
    scores,
    explanation: [
      `Squad ${squad.squad_number} was built using the ${squadMode} optimizer mode.`,
      `A post-build swap pass checked unused heroes and kept only score-improving swaps.`,
      ...squadExplanationDetails(improved.heroes, placements, squadMode),
      ...improved.heroes.map((h) => heroReason(h, squadMode)),
      `Gear assignment uses the best saved owned gear pool available across all heroes, not only currently equipped gear.`,
    ],
  };
}
  const unused = postPassUnused
    .map((h) => ({
      hero_key: h.hero_key,
      name: h.name,
      reason:
        "Not selected because the current spread scored lower than the chosen roster under the active optimizer mode.",
    }));
  const parityAudit = optimizerParityAudit(input.context);
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
  `Saved drone, overlord, and shared combat modifiers were included in optimizer candidate weighting.`,
  ...parityAudit,
],
    assumptions,
    context_snapshot: {
      hero_count: heroes.length,
      drone_ready: !!(input.context.drone.components || input.context.drone.combat_boost || input.context.drone.boost_chips),
      overlord_ready: !!(input.context.overlord.profile || input.context.overlord.skills || input.context.overlord.promote),
    },
  };
}
