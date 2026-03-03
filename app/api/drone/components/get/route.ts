// app/api/drone/components/get/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const owner_id = searchParams.get("owner_id");
  if (!owner_id) return NextResponse.json({ error: "owner_id is required" }, { status: 400 });

  const supabase = supabaseAdmin();
  const key = `${owner_id}:drone:components`;

  const res = await supabase.from("facts").select("*").eq("key", key).maybeSingle();
  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });

  return NextResponse.json({ row: res.data ?? null });
}
