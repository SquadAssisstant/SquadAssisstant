import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";

export type SessionLite = { profileId: string };

export type BattleContext = {
  profile_id: string;
  squad_slots: Array<{ slot: number; hero_upload_id: number | null }>;
  heroes: Record<
    string,
    {
      profile: any | null;
      gear: any | null;
      skills: any | null;
    }
  >;
  drone: {
    components: any | null;
    combat_boost: any | null;
    boost_chips: any | null;
  };
  overlord: {
    profile: any | null;
    skills: any | null;
    promote: any | null;
    bond: any | null;
    train: any | null;
  };
};

function getCookieFromHeader(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
  }
  return undefined;
}

export async function requireSessionFromReq(req: Request): Promise<SessionLite | null> {
  const token = getCookieFromHeader(req.headers.get("cookie"), sessionCookieName());
  if (!token) return null;

  try {
    const s = await verifySession(token);
    return { profileId: String((s as any).profileId) };
  } catch {
    return null;
  }
}

async function fetchPlayerState(req: Request): Promise<any | null> {
  try {
    const origin = new URL(req.url).origin;
    const cookie = req.headers.get("cookie") ?? "";
    const res = await fetch(`${origin}/api/player/state`, {
      headers: { cookie },
      cache: "no-store",
    });

    const text = await res.text().catch(() => "");
    if (!text) return null;

    const json = JSON.parse(text);
    if (!res.ok) return null;
    return json?.state ?? null;
  } catch {
    return null;
  }
}

function normalizeSquadSlots(state: any): Array<{ slot: number; hero_upload_id: number | null }> {
  const raw = state?.squads?.slots;
  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((s: any, idx: number) => ({
        slot: Number(s?.slot ?? idx + 1),
        hero_upload_id: Number.isFinite(Number(s?.hero_upload_id)) ? Number(s.hero_upload_id) : null,
      }))
      .slice(0, 20);
  }

  return [];
}

function valueUploadId(value: any): string | null {
  const v = value?.source_upload_id;
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

export async function buildBattleContextFromRequest(req: Request, profileId: string): Promise<BattleContext> {
  const sb = supabaseAdmin() as any;
  const state = await fetchPlayerState(req);
  const squad_slots = normalizeSquadSlots(state);

  const domains = [
    "hero_profile",
    "hero_gear",
    "hero_skills",
    "drone_components",
    "drone_combat_boost",
    "drone_boost_chips",
    "overlord_profile",
    "overlord_skills",
    "overlord_promote",
    "overlord_bond",
    "overlord_train",
  ];

  const { data, error } = await sb
    .from("facts")
    .select("domain, key, value, updated_at")
    .eq("created_by_profile_id", profileId)
    .in("domain", domains)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows: any[] = Array.isArray(data) ? data : [];

  const heroes: BattleContext["heroes"] = {};
  const drone: BattleContext["drone"] = {
    components: null,
    combat_boost: null,
    boost_chips: null,
  };
  const overlord: BattleContext["overlord"] = {
    profile: null,
    skills: null,
    promote: null,
    bond: null,
    train: null,
  };

  for (const row of rows) {
    const domain = String(row?.domain ?? "");
    const value = row?.value ?? null;

    if (domain === "hero_profile" || domain === "hero_gear" || domain === "hero_skills") {
      const uploadId = valueUploadId(value) ?? row?.key ?? "";
      if (!heroes[uploadId]) {
        heroes[uploadId] = {
          profile: null,
          gear: null,
          skills: null,
        };
      }

      if (domain === "hero_profile") heroes[uploadId].profile = value;
      if (domain === "hero_gear") heroes[uploadId].gear = value;
      if (domain === "hero_skills") heroes[uploadId].skills = value;
      continue;
    }

    if (domain === "drone_components") {
      drone.components = drone.components ?? value;
      continue;
    }
    if (domain === "drone_combat_boost") {
      drone.combat_boost = drone.combat_boost ?? value;
      continue;
    }
    if (domain === "drone_boost_chips") {
      drone.boost_chips = drone.boost_chips ?? value;
      continue;
    }

    if (domain === "overlord_profile") {
      overlord.profile = overlord.profile ?? value;
      continue;
    }
    if (domain === "overlord_skills") {
      overlord.skills = overlord.skills ?? value;
      continue;
    }
    if (domain === "overlord_promote") {
      overlord.promote = overlord.promote ?? value;
      continue;
    }
    if (domain === "overlord_bond") {
      overlord.bond = overlord.bond ?? value;
      continue;
    }
    if (domain === "overlord_train") {
      overlord.train = overlord.train ?? value;
      continue;
    }
  }

  return {
    profile_id: profileId,
    squad_slots,
    heroes,
    drone,
    overlord,
  };
}

export function summarizeBattleContext(context: BattleContext): string {
  const heroIds = Object.keys(context.heroes);
  const assignedHeroes = context.squad_slots.filter((s) => s.hero_upload_id != null).length;

  const pieces: string[] = [];
  pieces.push(`Assigned squad slots: ${assignedHeroes}`);
  pieces.push(`Hero records loaded: ${heroIds.length}`);

  const heroProfiles = heroIds.filter((id) => context.heroes[id]?.profile).length;
  const heroGear = heroIds.filter((id) => context.heroes[id]?.gear).length;
  const heroSkills = heroIds.filter((id) => context.heroes[id]?.skills).length;

  pieces.push(`Hero profiles: ${heroProfiles}`);
  pieces.push(`Hero gear sets: ${heroGear}`);
  pieces.push(`Hero skills sets: ${heroSkills}`);

  pieces.push(
    `Drone data: ${
      [context.drone.components, context.drone.combat_boost, context.drone.boost_chips].filter(Boolean).length
    }/3`
  );

  pieces.push(
    `Overlord data: ${
      [
        context.overlord.profile,
        context.overlord.skills,
        context.overlord.promote,
        context.overlord.bond,
        context.overlord.train,
      ].filter(Boolean).length
    }/5`
  );

  return pieces.join(" • ");
}
