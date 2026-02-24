import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";

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

type StateJson = Record<string, any>;

function ensureSquadStateShape(state: any): StateJson {
  const next: StateJson = typeof state === "object" && state ? { ...state } : {};
  if (!next.squads || typeof next.squads !== "object") next.squads = {};

  for (const squad of ["1", "2", "3", "4"]) {
    if (!next.squads[squad] || typeof next.squads[squad] !== "object") next.squads[squad] = {};
    if (!next.squads[squad].slots || typeof next.squads[squad].slots !== "object") next.squads[squad].slots = {};

    // Normalize to always have 1..5 keys
    for (const slot of ["1", "2", "3", "4", "5"]) {
      if (!(slot in next.squads[squad].slots)) next.squads[squad].slots[slot] = null;
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
    .select("profile_id, state, updated_at")
    .eq("profile_id", s.profileId)
    .maybeSingle();

  if (q.error) return NextResponse.json({ ok: false, error: q.error.message }, { status: 500 });

  const state = ensureSquadStateShape(q.data?.state);

  // If row missing, create it so UI can write slots immediately
  if (!q.data) {
    const ins = await sb
      .from("player_state")
      .insert({ profile_id: s.profileId, state, updated_at: new Date().toISOString() })
      .select("state, updated_at")
      .single();

    if (ins.error) return NextResponse.json({ ok: false, error: ins.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, state: ins.data.state, updated_at: ins.data.updated_at });
  }

  return NextResponse.json({ ok: true, state, updated_at: q.data.updated_at });
}

export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { op?: "set_slot"; squad?: number; slot?: number; upload_id?: number | null }
    | null;

  if (!body || body.op !== "set_slot") {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const squad = Number(body.squad);
  const slot = Number(body.slot);
  const upload_id = body.upload_id === null ? null : Number(body.upload_id);

  if (![1, 2, 3, 4].includes(squad) || ![1, 2, 3, 4, 5].includes(slot)) {
    return NextResponse.json({ ok: false, error: "Invalid squad or slot" }, { status: 400 });
  }
  if (upload_id !== null && !Number.isFinite(upload_id)) {
    return NextResponse.json({ ok: false, error: "Invalid upload_id" }, { status: 400 });
  }

  const sb: any = supabaseAdmin();

  // If setting to an upload_id, make sure it belongs to this profile.
  if (upload_id !== null) {
    const check = await sb
      .from("player_uploads")
      .select("id, kind")
      .eq("id", upload_id)
      .eq("profile_id", s.profileId)
      .limit(1)
      .maybeSingle();

    if (check.error) return NextResponse.json({ ok: false, error: check.error.message }, { status: 500 });
    if (!check.data) return NextResponse.json({ ok: false, error: "Upload not found" }, { status: 404 });

    // Optional safety: only allow hero_profile into squad slots
    if (String(check.data.kind) !== "hero_profile") {
      return NextResponse.json(
        { ok: false, error: "Only hero_profile uploads can be assigned to squad slots" },
        { status: 400 }
      );
    }
  }

  // Load current player_state row
  const cur = await sb
    .from("player_state")
    .select("state")
    .eq("profile_id", s.profileId)
    .maybeSingle();

  if (cur.error) return NextResponse.json({ ok: false, error: cur.error.message }, { status: 500 });

  const currentState = ensureSquadStateShape(cur.data?.state);
  const sKey = String(squad);
  const slotKey = String(slot);

  currentState.squads[sKey].slots[slotKey] = upload_id;

  // Upsert player_state row
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
    .select("state, updated_at")
    .single();

  if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });

  return NextResponse.json({ ok: true, state: up.data.state, updated_at: up.data.updated_at });
       }
