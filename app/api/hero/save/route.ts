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

type Body = {
  upload_id: number;
  hero_key: string; // required stable name
  level?: number | null;
  stars?: number | null;
  gear?: any; // JSON
  skills?: any; // JSON
  notes?: string | null;
};

export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });

  const upload_id = Number(body.upload_id);
  const hero_key = String(body.hero_key || "").trim();
  if (!Number.isFinite(upload_id) || !hero_key) {
    return NextResponse.json({ ok: false, error: "upload_id and hero_key are required" }, { status: 400 });
  }

  const sb: any = supabaseAdmin();

  // verify upload belongs to player
  const up = await sb
    .from("player_uploads")
    .select("id, kind, facts_id")
    .eq("id", upload_id)
    .eq("profile_id", s.profileId)
    .maybeSingle();

  if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  if (!up.data) return NextResponse.json({ ok: false, error: "Upload not found" }, { status: 404 });

  // We store hero profile info in facts under domain "hero"
  const domain = "hero";
  const key = hero_key;

  const value = {
    hero_key,
    level: body.level ?? null,
    stars: body.stars ?? null,
    gear: body.gear ?? null,
    skills: body.skills ?? null,
    notes: body.notes ?? null,
    source: { kind: "manual_edit", upload_id },
    updated_at: new Date().toISOString(),
  };

  let factsId: string | null = up.data.facts_id ? String(up.data.facts_id) : null;

  if (!factsId) {
    // create facts row
    const ins = await sb
      .from("facts")
      .insert({
        domain,
        key,
        value,
        status: "active",
        confidence: 1,
        source_urls: [],
        created_by_profile_id: s.profileId,
      })
      .select("id")
      .single();

    if (ins.error) return NextResponse.json({ ok: false, error: ins.error.message }, { status: 500 });
    factsId = String(ins.data.id);

    // link upload -> facts
    const link = await sb
      .from("player_uploads")
      .update({ facts_id: factsId })
      .eq("id", upload_id)
      .eq("profile_id", s.profileId);

    if (link.error) return NextResponse.json({ ok: false, error: link.error.message }, { status: 500 });
  } else {
    // update existing facts row
    const upd = await sb
      .from("facts")
      .update({ value, key })
      .eq("id", factsId);

    if (upd.error) return NextResponse.json({ ok: false, error: upd.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, facts_id: factsId });
}
