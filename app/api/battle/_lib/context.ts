import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";

type StatMods = {
  attack_flat: number;
  attack_pct: number;
  hp_flat: number;
  hp_pct: number;
  defense_flat: number;
  defense_pct: number;
  power_flat: number;
  power_pct: number;
  damage_pct: number;
  damage_reduction_pct: number;
  march_flat: number;
  march_pct: number;
  skill_damage_pct: number;
  crit_pct: number;
};

const emptyMods = (): StatMods => ({
  attack_flat: 0,
  attack_pct: 0,
  hp_flat: 0,
  hp_pct: 0,
  defense_flat: 0,
  defense_pct: 0,
  power_flat: 0,
  power_pct: 0,
  damage_pct: 0,
  damage_reduction_pct: 0,
  march_flat: 0,
  march_pct: 0,
  skill_damage_pct: 0,
  crit_pct: 0,
});

function addMods(a: StatMods, b: Partial<StatMods> | undefined | null): StatMods {
  const out = { ...a };
  if (!b) return out;
  for (const key of Object.keys(out) as (keyof StatMods)[]) {
    out[key] += safeNum(b[key]);
  }
  return out;
}

function getCookieFromHeader(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
  }
  return undefined;
}

function safeNum(v: any) {
  if (typeof v === "string") {
    const cleaned = v.replace(/,/g, "").replace(/%/g, "").trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normKey(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function titleCase(v: any) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s
    .split(/[\s_-]+/)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function guessTroopType(raw: any) {
  const s = normKey(raw);
  if (s.includes("tank")) return "tank";
  if (s.includes("missile")) return "missile";
  if (s.includes("air")) return "aircraft";
  if (s.includes("aircraft")) return "aircraft";
  return "unknown";
}

function parseNumberFromText(raw: any): number {
  if (typeof raw === "number") return safeNum(raw);
  const s = String(raw ?? "");
  const match = s.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? safeNum(match[0]) : 0;
}

function isPercentText(raw: any): boolean {
  return String(raw ?? "").includes("%");
}

function modFromStatText(statRaw: any, valueRaw: any, valueNumeric?: any): StatMods {
  const stat = normKey(statRaw);
  const rawValue = valueRaw ?? valueNumeric;
  const amount = safeNum(valueNumeric) || parseNumberFromText(rawValue);
  const isPct = isPercentText(rawValue) || stat.includes("%") || stat.includes("percent");

  const mods = emptyMods();

  if (!amount) return mods;

  const addFlatOrPct = (flatKey: keyof StatMods, pctKey: keyof StatMods) => {
    if (isPct) mods[pctKey] += amount;
    else mods[flatKey] += amount;
  };

  if (stat.includes("atk") || stat.includes("attack")) addFlatOrPct("attack_flat", "attack_pct");
  else if (stat.includes("hp") || stat.includes("health")) addFlatOrPct("hp_flat", "hp_pct");
  else if (stat.includes("def") || stat.includes("defense")) addFlatOrPct("defense_flat", "defense_pct");
  else if (stat.includes("power")) addFlatOrPct("power_flat", "power_pct");
  else if (stat.includes("march")) addFlatOrPct("march_flat", "march_pct");
  else if (stat.includes("skill")) mods.skill_damage_pct += amount;
  else if (stat.includes("crit")) mods.crit_pct += amount;
  else if (stat.includes("damage reduction") || stat.includes("dmg reduction")) mods.damage_reduction_pct += amount;
  else if (stat.includes("damage") || stat.includes("dmg")) mods.damage_pct += amount;

  return mods;
}

function modsFromBoostArray(boosts: any[]): StatMods {
  let mods = emptyMods();
  for (const boost of Array.isArray(boosts) ? boosts : []) {
    mods = addMods(
      mods,
      modFromStatText(
        boost?.stat ?? boost?.name ?? boost?.label,
        boost?.value_raw ?? boost?.value ?? boost?.amount,
        boost?.value_numeric
      )
    );
  }
  return mods;
}

function modsFromFreeText(raw: any): StatMods {
  const text = Array.isArray(raw) ? raw.join(" ") : String(raw ?? "");
  const mods = emptyMods();

  const patterns: Array<[RegExp, keyof StatMods]> = [
    [/(atk|attack)[^\d+-]*([+-]?\d+(?:\.\d+)?)%/gi, "attack_pct"],
    [/(hp|health)[^\d+-]*([+-]?\d+(?:\.\d+)?)%/gi, "hp_pct"],
    [/(def|defense)[^\d+-]*([+-]?\d+(?:\.\d+)?)%/gi, "defense_pct"],
    [/(power)[^\d+-]*([+-]?\d+(?:\.\d+)?)%/gi, "power_pct"],
    [/(march)[^\d+-]*([+-]?\d+(?:\.\d+)?)%/gi, "march_pct"],
    [/(skill damage|skill dmg)[^\d+-]*([+-]?\d+(?:\.\d+)?)%/gi, "skill_damage_pct"],
    [/(damage reduction|dmg reduction)[^\d+-]*([+-]?\d+(?:\.\d+)?)%/gi, "damage_reduction_pct"],
    [/(damage|dmg)[^\d+-]*([+-]?\d+(?:\.\d+)?)%/gi, "damage_pct"],
    [/(crit|critical)[^\d+-]*([+-]?\d+(?:\.\d+)?)%/gi, "crit_pct"],
  ];

  for (const [regex, key] of patterns) {
    for (const match of text.matchAll(regex)) {
      mods[key] += safeNum(match[2]);
    }
  }

  return mods;
}

function normalizeGearPiece(raw: any, heroKey: string, slot: "weapon" | "data_chip" | "armor" | "radar") {
  if (!raw) return null;

  const boostMods = modsFromBoostArray(raw.boosts ?? []);
  const legacyMods = emptyMods();
  legacyMods.attack_flat += safeNum(raw.atk_bonus || raw.attack || raw.attack_bonus);
  legacyMods.hp_flat += safeNum(raw.hp_bonus || raw.hp || raw.health_bonus);
  legacyMods.defense_flat += safeNum(raw.def_bonus || raw.defense || raw.defense_bonus);
  legacyMods.power_flat += safeNum(raw.power_bonus || raw.power);

  const textMods = modsFromFreeText([raw.notes, raw.description, raw.raw].filter(Boolean));

  const mods = addMods(addMods(boostMods, legacyMods), textMods);

  return {
    id: `${heroKey}:${slot}:${String(raw.item_name || raw.name || "gear").toLowerCase()}`,
    slot,
    name: raw.item_name ? String(raw.item_name) : raw.name ? String(raw.name) : null,
    stars: safeNum(raw.stars),
    level: safeNum(raw.level),
    rarity: raw.rarity ? String(raw.rarity) : null,
    notes: raw.notes ? String(raw.notes) : null,
    boosts: Array.isArray(raw.boosts) ? raw.boosts : [],
    mods,
    atk_bonus: mods.attack_flat,
    hp_bonus: mods.hp_flat,
    def_bonus: mods.defense_flat,
    power_bonus: mods.power_flat,
  };
}

function normalizeHeroSkill(raw: any, heroKey: string, idx: number) {
  const text = [raw?.summary, raw?.effect_summary, raw?.scaling_detail, raw?.description]
    .filter(Boolean)
    .join(" ");

  const mods = addMods(
    modsFromFreeText(text),
    modsFromBoostArray(raw?.bonuses ?? raw?.effects ?? [])
  );

  const multiplierFromText = (() => {
    const s = String(text || "");
    const m =
      s.match(/(\d+(?:\.\d+)?)%\s*(?:damage|dmg|attack|atk)/i) ||
      s.match(/damage[^\d]*(\d+(?:\.\d+)?)%/i);
    return m ? safeNum(m[1]) : 0;
  })();

  const kindRaw = String(raw?.kind || raw?.type || "").toLowerCase();
  const kind = ["auto", "tactical", "passive"].includes(kindRaw) ? kindRaw : "unknown";

  return {
    id: `${heroKey}:skill:${idx + 1}`,
    slot: safeNum(raw?.slot) || idx + 1,
    name: raw?.name ? String(raw.name) : null,
    level: safeNum(raw?.level),
    multiplier_pct: safeNum(raw?.multiplier_pct || raw?.multiplier || raw?.damage_pct) || multiplierFromText,
    effect_summary: raw?.effect_summary ? String(raw.effect_summary) : raw?.summary ? String(raw.summary) : null,
    scaling_detail: raw?.scaling_detail ? String(raw.scaling_detail) : null,
    kind,
    mods,
  };
}

function collectDroneModifiers(drone: any): StatMods {
  let mods = emptyMods();

  mods = addMods(mods, modsFromFreeText(JSON.stringify(drone?.profile ?? {})));
  mods = addMods(mods, modsFromFreeText(JSON.stringify(drone?.components ?? {})));
  mods = addMods(mods, modsFromFreeText(JSON.stringify(drone?.combat_boost ?? {})));

  const chipSets = drone?.boost_chips?.chip_sets ?? {};
  for (const set of Object.values(chipSets) as any[]) {
    mods = addMods(mods, modsFromFreeText(JSON.stringify(set ?? {})));
    for (const skill of Object.values(set?.skills ?? {}) as any[]) {
      mods = addMods(mods, modsFromFreeText([skill?.name, skill?.description].filter(Boolean).join(" ")));
      if (skill?.chip_power != null) mods.power_flat += safeNum(skill.chip_power);
    }
    if (set?.displayed_squad_power != null) mods.power_flat += safeNum(set.displayed_squad_power) * 0.02;
  }

  return mods;
}

function collectOverlordModifiers(overlord: any): StatMods {
  let mods = emptyMods();

  mods = addMods(mods, modsFromFreeText(JSON.stringify(overlord?.profile ?? {})));
  mods = addMods(mods, modsFromFreeText(JSON.stringify(overlord?.promote ?? {})));
  mods = addMods(mods, modsFromFreeText(JSON.stringify(overlord?.bond ?? {})));
  mods = addMods(mods, modsFromFreeText(JSON.stringify(overlord?.train ?? {})));

  const skills = Array.isArray(overlord?.skills?.skills) ? overlord.skills.skills : [];
  for (const skill of skills) {
    mods = addMods(mods, modsFromFreeText(JSON.stringify(skill ?? {})));
    mods = addMods(mods, modsFromBoostArray(skill?.bonuses ?? []));
    mods = addMods(mods, modsFromBoostArray(skill?.locked_bonuses ?? []));
  }

  return mods;
}

export async function requireSessionFromReq(req: Request): Promise<{ profileId: string } | null> {
  const token = getCookieFromHeader(req.headers.get("cookie"), sessionCookieName());
  if (!token) return null;
  try {
    const session: any = await verifySession(token);
    return { profileId: String(session.profileId) };
  } catch {
    return null;
  }
}

export async function buildBattleContextFromRequest(req: Request) {
  const session = await requireSessionFromReq(req);
  if (!session) {
    throw new Error("Unauthorized");
  }
  return buildBattleCombatContext(session.profileId);
}

export async function buildBattleCombatContext(profileId: string) {
  const sb: any = supabaseAdmin();

  const factsRes = await sb
    .from("facts")
    .select("domain, key, value, updated_at")
    .eq("created_by_profile_id", profileId)
    .in("domain", [
      "hero_profile",
      "hero_gear",
      "hero_skills",
      "drone_profile",
      "drone_components",
      "drone_combat_boost",
      "drone_boost_chips",
      "overlord_profile",
      "overlord_skills",
      "overlord_promote",
      "overlord_bond",
      "overlord_train",
      "squad",
      "squads",
      "squad_roster",
      "player_squads",
    ])
    .order("updated_at", { ascending: false });

  if (factsRes.error) {
    throw new Error(factsRes.error.message);
  }

  const observationsRes = await sb
    .from("game_observations")
    .select("observation_type, entity_type, entity_key, attributes, observed_value, confidence, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1000);

  if (observationsRes.error) {
    throw new Error(observationsRes.error.message);
  }

  const sharedGameData = Array.isArray(observationsRes.data) ? observationsRes.data : [];
  const heroMap = new Map<string, any>();
  const drone: any = {};
  const overlord: any = {};
  const squads: any[] = [];

  function ensureHero(heroKey: string, name: string) {
    const existing = heroMap.get(heroKey);
    if (existing) return existing;

    const next = {
      hero_key: heroKey,
      name: name || titleCase(heroKey),
      troop_type: "unknown",
      assigned_squad_slot: null,
      level: 0,
      stars: 0,
      base_stats: {
        hp: 0,
        atk: 0,
        def: 0,
        power: 0,
        morale: 100,
        march_size: 0,
      },
      gear: {
        weapon: null,
        data_chip: null,
        armor: null,
        radar: null,
      },
      gear_mods: emptyMods(),
      skill_mods: emptyMods(),
      skills: [],
      completeness: {
        has_profile: false,
        has_gear: false,
        has_skills: false,
      },
    };

    heroMap.set(heroKey, next);
    return next;
  }

  for (const fact of factsRes.data ?? []) {
    const domain = String(fact.domain || "");
    const v = fact.value || {};

    if (domain.startsWith("drone_")) {
      if (domain === "drone_profile") drone.profile = v;
      if (domain === "drone_components") drone.components = v;
      if (domain === "drone_combat_boost") drone.combat_boost = v;
      if (domain === "drone_boost_chips") drone.boost_chips = v;
      continue;
    }

    if (domain.startsWith("overlord_")) {
      if (domain === "overlord_profile") overlord.profile = v;
      if (domain === "overlord_skills") overlord.skills = v;
      if (domain === "overlord_promote") overlord.promote = v;
      if (domain === "overlord_bond") overlord.bond = v;
      if (domain === "overlord_train") overlord.train = v;
      continue;
    }

    if (["squad", "squads", "squad_roster", "player_squads"].includes(domain)) {
      squads.push(v);
      continue;
    }

    const heroKey = normKey(v.hero_key || v.name || fact.key?.split(":").pop());
    if (!heroKey) continue;

    const hero = ensureHero(heroKey, titleCase(v.name || heroKey));

    if (domain === "hero_profile") {
      hero.name = titleCase(v.name || hero.name);
      hero.level = safeNum(v.level);
      hero.stars = safeNum(v.stars);
      hero.base_stats.hp = safeNum(v.stats?.hp);
      hero.base_stats.atk = safeNum(v.stats?.attack);
      hero.base_stats.def = safeNum(v.stats?.defense);
      hero.base_stats.power = safeNum(v.power);
      hero.base_stats.march_size = safeNum(v.stats?.march_size);
      hero.base_stats.morale = safeNum(v.morale) || 100;
      hero.troop_type = guessTroopType(v.troop_type || v.class_type || v.type);
      hero.assigned_squad_slot = v.assigned_squad_slot ?? v.squad_slot ?? null;
      hero.completeness.has_profile = true;
    }

    if (domain === "hero_gear") {
      const pieces = v.pieces || v.gear || {};
      hero.gear.weapon = normalizeGearPiece(pieces.weapon, heroKey, "weapon");
      hero.gear.data_chip = normalizeGearPiece(pieces.data_chip, heroKey, "data_chip");
      hero.gear.armor = normalizeGearPiece(pieces.armor, heroKey, "armor");
      hero.gear.radar = normalizeGearPiece(pieces.radar, heroKey, "radar");

      let gearMods = emptyMods();
      for (const piece of Object.values(hero.gear) as any[]) {
        gearMods = addMods(gearMods, piece?.mods);
      }

      hero.gear_mods = gearMods;
      hero.completeness.has_gear = !!(hero.gear.weapon || hero.gear.data_chip || hero.gear.armor || hero.gear.radar);
    }

    if (domain === "hero_skills") {
      const skillsRaw = Array.isArray(v.skills) ? v.skills : [];
      hero.skills = skillsRaw.map((raw: any, idx: number) => normalizeHeroSkill(raw, heroKey, idx));

      let skillMods = emptyMods();
      for (const skill of hero.skills) {
        skillMods = addMods(skillMods, skill.mods);
      }

      hero.skill_mods = skillMods;
      hero.completeness.has_skills = hero.skills.length > 0;
    }
  }

  drone.modifiers = collectDroneModifiers(drone);
  overlord.modifiers = collectOverlordModifiers(overlord);

  return {
    heroes: Array.from(heroMap.values()),
    squads,
    drone,
    overlord,
    shared_game_data: sharedGameData,
    shared_notes: [
      `Shared anonymous game observations loaded: ${sharedGameData.length}`,
      "Battle analyzer uses saved player data, anonymous shared game observations, and combat math formulas before AI estimation.",
      "Combat explanation references hero stats, gear, skills, drone, overlord, morale, lineup bonuses, and effective power.",
    ],
  };
}

export function summarizeBattleContext(context: any): string {
  const heroes = Array.isArray(context?.heroes) ? context.heroes : [];
  const sharedGameData = Array.isArray(context?.shared_game_data) ? context.shared_game_data : [];
  const droneReady = !!(
    context?.drone?.profile ||
    context?.drone?.components ||
    context?.drone?.combat_boost ||
    context?.drone?.boost_chips
  );
  const overlordReady = !!(
    context?.overlord?.profile ||
    context?.overlord?.skills ||
    context?.overlord?.promote ||
    context?.overlord?.bond ||
    context?.overlord?.train
  );

  const lines: string[] = [];
  lines.push(`Saved heroes loaded: ${heroes.length}`);
  lines.push(`Drone data ready: ${droneReady ? "yes" : "no"}`);
  lines.push(`Overlord data ready: ${overlordReady ? "yes" : "no"}`);
  lines.push(`Shared anonymous game observations: ${sharedGameData.length}`);

  if (heroes.length) {
    const sorted = [...heroes].sort((a, b) => Number(b?.base_stats?.power || 0) - Number(a?.base_stats?.power || 0));
    const top = sorted.slice(0, 5).map((h) => h.name).filter(Boolean);
    if (top.length) lines.push(`Top saved heroes: ${top.join(", ")}`);
  }

  return lines.join(" • ");
}
