import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";
import { PlayerCombatContext } from "@/lib/combat/types";
import { runOptimizer } from "@/lib/combat/optimizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getCookieFromHeader(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
  }
  return undefined;
}

async function requireSessionFromReq(req: Request): Promise<{ profileId: string } | null> {
  const token = getCookieFromHeader(req.headers.get("cookie"), sessionCookieName());
  if (!token) return null;
  try {
    const s: any = await verifySession(token);
    return { profileId: String(s.profileId) };
  } catch {
    return null;
  }
}

function safeNum(v: any) {
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

async function buildCombatContext(profileId: string): Promise<PlayerCombatContext> {
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
    ])
    .order("updated_at", { ascending: false });

  if (factsRes.error) throw new Error(factsRes.error.message);

  const heroMap = new Map<string, any>();
  const drone: any = {};
  const overlord: any = {};

  function ensureHero(heroKey: string, name: string) {
    const existing = heroMap.get(heroKey);
    if (existing) return existing;

    const next = {
      hero_key: heroKey,
      name: name || titleCase(heroKey),
      troop_type: "unknown",
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
      profile_upload_id: null,
      image_url: null,
      gear: {
        weapon: null,
        data_chip: null,
        armor: null,
        radar: null,
      },
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
      hero.profile_upload_id = safeNum(v.source_upload_id) || null;
      hero.raw_profile = v;
      hero.completeness.has_profile = true;
    }

    if (domain === "hero_gear") {
      const pieces = v.pieces || v.gear || {};
      const normPiece = (raw: any, slot: "weapon" | "data_chip" | "armor" | "radar") =>
        raw
          ? {
              id: `${heroKey}:${slot}:${String(raw.name || "gear").toLowerCase()}`,
              slot,
              name: raw.name ? String(raw.name) : null,
              stars: safeNum(raw.stars),
              level: safeNum(raw.level),
              atk_bonus: safeNum(raw.atk_bonus || raw.attack || raw.attack_bonus),
              hp_bonus: safeNum(raw.hp_bonus || raw.hp || raw.health_bonus),
              def_bonus: safeNum(raw.def_bonus || raw.defense || raw.defense_bonus),
              power_bonus: safeNum(raw.power_bonus || raw.power),
              source_hero_key: heroKey,
            }
          : null;

      hero.gear.weapon = normPiece(pieces.weapon, "weapon");
      hero.gear.data_chip = normPiece(pieces.data_chip, "data_chip");
      hero.gear.armor = normPiece(pieces.armor, "armor");
      hero.gear.radar = normPiece(pieces.radar, "radar");
      hero.completeness.has_gear = !!(hero.gear.weapon || hero.gear.data_chip || hero.gear.armor || hero.gear.radar);
    }

    if (domain === "hero_skills") {
      const skillsRaw = Array.isArray(v.skills) ? v.skills : [];
      hero.skills = skillsRaw.map((raw: any, idx: number) => ({
        id: `${heroKey}:skill:${idx + 1}`,
        name: raw?.name ? String(raw.name) : null,
        level: safeNum(raw?.level),
        multiplier_pct: safeNum(raw?.multiplier_pct || raw?.multiplier || raw?.damage_pct),
        effect_summary: raw?.effect_summary ? String(raw.effect_summary) : raw?.summary ? String(raw.summary) : null,
        kind: ["auto", "tactical", "passive"].includes(String(raw?.kind || "").toLowerCase())
          ? String(raw.kind).toLowerCase()
          : "unknown",
      }));
      hero.completeness.has_skills = hero.skills.length > 0;
    }
  }

  return {
    heroes: Array.from(heroMap.values()),
    drone,
    overlord,
    shared_notes: [
      "Optimizer uses full owned hero roster, not only heroes currently assigned to squads.",
      "No hero is allowed to appear in more than one optimized squad.",
      "Combat math follows saved formulas for stats, damage, morale, type advantage, lineup bonus, and effective power.",
    ],
  };
}

export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | {
        mode?: string;
        squad_count?: number;
        locked_heroes?: string[];
      }
    | null;

  try {
    const context = await buildCombatContext(s.profileId);
    const result = runOptimizer({
      context,
      mode: body?.mode,
      squadCount: body?.squad_count,
      lockedHeroes: Array.isArray(body?.locked_heroes) ? body?.locked_heroes : [],
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Optimizer failed" },
      { status: 500 }
    );
  }
}
