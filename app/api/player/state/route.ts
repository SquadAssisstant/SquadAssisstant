import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";

export const runtime = "nodejs";

function getCookieFromHeader(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
  }
  return undefined;
}

async function requireSessionFromReq(req: Request) {
  const token = getCookieFromHeader(req.headers.get("cookie"), sessionCookieName());
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

type PlayerStateRow = {
  id?: string;
  profile_id: string;
  state: any;
  updated_at?: string;
};

function ensureSquadStateShape(state: any) {
  const next = typeof state === "object" && state ? { ...state } : {};
  if (!next.squads || typeof next.squads !== "object") next.squads = {};
  for (const squad of ["1", "2", "3", "4"]) {
    if (!next.squads[squad] || typeof next.squads[squad] !== "object") next.squads[squad] = {};
    if (!next.squads[squad].slots || typeof next.squads[squad].slots !== "object") next.squads[squad].slots = {};
  }
  return next;
}

function toUploadIdOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
  }
  return null;
}

function normalizeStateForClient(state: any) {
  const next = ensureSquadStateShape(state);

  for (const squad of ["1", "2", "3", "4"]) {
    const slots = next.squads?.[squad]?.slots;
    if (!slots || typeof slots !== "object") continue;

    for (const slot of ["1", "2", "3", "4", "5"]) {
      const coerced = toUploadIdOrNull(slots[slot]);
      slots[slot] = coerced; // always number|null
    }
  }

  return next;
}

export async function GET(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const sb: any = supabaseAdmin();
  const q = await sb
    .from("player_state")
    .select("id, profile_id, state, updated_at")
    .eq("profile_id", s.profileId)
    .limit(1)
    .maybeSingle();

  if (q.error) return NextResponse.json({ ok: false, error: q.error.message }, { status: 500 });

  const row: PlayerStateRow | null = q.data ?? null;
  const state = normalizeStateForClient(row?.state);
  return NextResponse.json({ ok: true, state });
}

export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { op?: "set_slot"; squad?: number; slot?: number; upload_id?: unknown }
    | null;

  if (!body || body.op !== "set_slot") {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const squad = Number(body.squad);
  const slot = Number(body.slot);
  const upload_id = toUploadIdOrNull(body.upload_id);

  if (![1, 2, 3, 4].includes(squad) || ![1, 2, 3, 4, 5].includes(slot)) {
    return NextResponse.json({ ok: false, error: "Invalid squad or slot" }, { status: 400 });
  }

  const sb: any = supabaseAdmin();

  // If setting a hero, ensure the upload exists and belongs to this profile.
  if (upload_id !== null) {
    const check = await sb
      .from("player_uploads")
      .select("id")
      .eq("id", upload_id)
      .eq("profile_id", s.profileId)
      .limit(1)
      .maybeSingle();

    if (check.error) return NextResponse.json({ ok: false, error: check.error.message }, { status: 500 });
    if (!check.data) return NextResponse.json({ ok: false, error: "Upload not found" }, { status: 404 });
  }

  // Load current state
  const cur = await sb
    .from("player_state")
    .select("id, state")
    .eq("profile_id", s.profileId)
    .limit(1)
    .maybeSingle();

  if (cur.error) return NextResponse.json({ ok: false, error: cur.error.message }, { status: 500 });

  const currentState = normalizeStateForClient(cur.data?.state);
  const sKey = String(squad);
  const slotKey = String(slot);

  currentState.squads[sKey].slots[slotKey] = upload_id;

  const up = await sb
    .from("player_state")
    .upsert(
      {
        profile_id: s.profileId,
        state: currentState,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id" }
    )
    .select("state")
    .single();

  if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });

  return NextResponse.json({ ok: true, state: normalizeStateForClient(up.data.state) });
}
