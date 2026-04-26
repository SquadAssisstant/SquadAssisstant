import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";
import { saveAnonymousGameObservation } from "@/lib/gameObservations";

export const runtime = "nodejs";

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

function toIntOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d]/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function clampStr(v: any, max = 120): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function pushHistory(existingValue: any, nextSnapshot: any) {
  const prev = existingValue && typeof existingValue === "object" ? existingValue : null;
  if (!prev) return nextSnapshot;

  const prevCore = JSON.stringify({
    chip_sets: prev.chip_sets ?? null,
    combat_boost: prev.combat_boost ?? null,
  });
  const nextCore = JSON.stringify({
    chip_sets: nextSnapshot.chip_sets ?? null,
    combat_boost: nextSnapshot.combat_boost ?? null,
  });

  if (prevCore === nextCore) return { ...prev, ...nextSnapshot };

  const history = Array.isArray(prev._history) ? prev._history.slice(0) : [];
  history.unshift({
    at: new Date().toISOString(),
    value: prev,
  });

  return { ...prev, ...nextSnapshot, _history: history.slice(0, 50) };
}

function normalizeSkill(skill: any, troopType: string, skillType: string) {
  return {
    troop_type: troopType,
    skill_type: skillType,
    name: clampStr(skill?.name, 120),
    chip_power: toIntOrNull(skill?.chip_power),
    description: clampStr(skill?.description, 500),
  };
}

export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | {
        upload_id?: number;
        value?: any;
      }
    | null;

  const uploadId = Number(body?.upload_id);
  if (!Number.isFinite(uploadId)) {
    return NextResponse.json({ ok: false, error: "Missing/invalid upload_id" }, { status: 400 });
  }

  if (!body?.value || body.value.kind !== "drone_boost_chips") {
    return NextResponse.json({ ok: false, error: "value.kind must be drone_boost_chips" }, { status: 400 });
  }

  const sb: any = supabaseAdmin();

  const up = await sb
    .from("player_uploads")
    .select("id, storage_path")
    .eq("id", uploadId)
    .eq("profile_id", s.profileId)
    .maybeSingle();

  if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  if (!up.data) return NextResponse.json({ ok: false, error: "Upload not found" }, { status: 404 });

  const domain = "drone_boost_chips";
  const key = `${s.profileId}:drone:boost_chips`;

  const existing = await sb
    .from("facts")
    .select("id, value")
    .eq("domain", domain)
    .eq("key", key)
    .maybeSingle();

  if (existing.error) return NextResponse.json({ ok: false, error: existing.error.message }, { status: 500 });

  const incoming = body.value ?? {};
  const nextSnapshot = {
    kind: "drone_boost_chips",
    chip_sets: {
      tank: {
        troop_type: "tank",
        label: clampStr(incoming?.chip_sets?.tank?.label, 80) ?? "Tank Chip Set",
        assigned_squad_slot: toIntOrNull(incoming?.chip_sets?.tank?.assigned_squad_slot),
        displayed_squad_power: clampStr(incoming?.chip_sets?.tank?.displayed_squad_power, 40),
        skills: {
          initial_move: normalizeSkill(incoming?.chip_sets?.tank?.skills?.initial_move, "tank", "initial_move"),
          offensive: normalizeSkill(incoming?.chip_sets?.tank?.skills?.offensive, "tank", "offensive"),
          defense: normalizeSkill(incoming?.chip_sets?.tank?.skills?.defense, "tank", "defense"),
          interference: normalizeSkill(incoming?.chip_sets?.tank?.skills?.interference, "tank", "interference"),
        },
      },
      air: {
        troop_type: "air",
        label: clampStr(incoming?.chip_sets?.air?.label, 80) ?? "Air Chip Set",
        assigned_squad_slot: toIntOrNull(incoming?.chip_sets?.air?.assigned_squad_slot),
        displayed_squad_power: clampStr(incoming?.chip_sets?.air?.displayed_squad_power, 40),
        skills: {
          initial_move: normalizeSkill(incoming?.chip_sets?.air?.skills?.initial_move, "air", "initial_move"),
          offensive: normalizeSkill(incoming?.chip_sets?.air?.skills?.offensive, "air", "offensive"),
          defense: normalizeSkill(incoming?.chip_sets?.air?.skills?.defense, "air", "defense"),
          interference: normalizeSkill(incoming?.chip_sets?.air?.skills?.interference, "air", "interference"),
        },
      },
      missile: {
        troop_type: "missile",
        label: clampStr(incoming?.chip_sets?.missile?.label, 80) ?? "Missile Chip Set",
        assigned_squad_slot: toIntOrNull(incoming?.chip_sets?.missile?.assigned_squad_slot),
        displayed_squad_power: clampStr(incoming?.chip_sets?.missile?.displayed_squad_power, 40),
        skills: {
          initial_move: normalizeSkill(incoming?.chip_sets?.missile?.skills?.initial_move, "missile", "initial_move"),
          offensive: normalizeSkill(incoming?.chip_sets?.missile?.skills?.offensive, "missile", "offensive"),
          defense: normalizeSkill(incoming?.chip_sets?.missile?.skills?.defense, "missile", "defense"),
          interference: normalizeSkill(incoming?.chip_sets?.missile?.skills?.interference, "missile", "interference"),
        },
      },
    },
    combat_boost: {
      notes: clampStr(incoming?.combat_boost?.notes, 500),
      raw: incoming?.combat_boost?.raw && typeof incoming.combat_boost.raw === "object" ? incoming.combat_boost.raw : {},
    },
    source_upload_id: uploadId,
    saved_at: new Date().toISOString(),
    source: { upload_id: uploadId, manual: true },
  };

  const mergedValue = pushHistory(existing.data?.value, nextSnapshot);

  const fx = await sb
    .from("facts")
    .upsert(
      {
        domain,
        key,
        value: mergedValue,
        status: "confirmed",
        confidence: 1.0,
        source_urls: up.data.storage_path ? [up.data.storage_path] : [],
        created_by_profile_id: s.profileId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "domain,key" }
    )
    .select("id")
    .single();

  if (fx.error) return NextResponse.json({ ok: false, error: fx.error.message }, { status: 500 });
  const obs = await saveAnonymousGameObservation(sb, {
  observation_type: domain,
  entity_type: domain.startsWith("hero_")
    ? "hero"
    : domain.startsWith("drone_")
      ? "drone"
      : "overlord",
  entity_key: domain,
  value: nextSnapshot,
});

if (obs.error) {
  return NextResponse.json({ ok: false, error: obs.error.message }, { status: 500 });
}

  return NextResponse.json({ ok: true, fact_id: fx.data.id });
}
