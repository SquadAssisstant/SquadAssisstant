// app/api/drone/combat_boost/get/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const player_id = searchParams.get("player_id");

  if (!player_id) {
    return NextResponse.json({ error: "player_id is required" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const key = `${player_id}:drone:combat_boost`;

  const res = await supabase
    .from("facts")
    .select("*")
    .eq("key", key)
    .maybeSingle();

  if (res.error) {
    return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  return NextResponse.json({ row: res.data ?? null });
}
