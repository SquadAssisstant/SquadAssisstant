import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function normalizeUsername(u: string) {
  return u.trim();
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const username = normalizeUsername((body?.username ?? "").toString());
  const password = (body?.password ?? "").toString();

  if (!username || username.length < 3) {
    return NextResponse.json({ error: "Username must be at least 3 characters." }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const pass_hash = await bcrypt.hash(password, 10);

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .insert({ username, pass_hash })
    .select("id, username")
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: error?.message ?? "Failed to create profile." }, { status: 400 });
  }

  // Initialize a minimal player_state blob (safe defaults)
  const initialState = {
    squads: {
      squad1: { heroes: [null, null, null, null, null], overlord: null },
      squad2: { heroes: [null, null, null, null, null], overlord: null },
      squad3: { heroes: [null, null, null, null, null], overlord: null },
      squad4: { heroes: [null, null, null, null, null], overlord: null },
    },
    gates: {
      // user will set later (or inferred from uploads)
      droneUnlocked: false,
      overlordUnlocked: false,
      serverDay: null,
      season: null,
      seasonDay: null,
    },
    heroes: {},     // per-hero owned/level/stars later
    gear: {},       // inventory later
    drone: {},      // drone state later
    overlord: {},   // overlord state later
  };

  await supabaseAdmin.from("player_state").insert({
    profile_id: profile.id,
    state: initialState,
  });

  return NextResponse.json({ ok: true, username: profile.username });
}
