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

function normalizeHeroName(name: unknown): string {
  const s = String(name ?? "").trim();
  if (!s) return "";
  return s.slice(0, 1).toUpperCase() + s.slice(1);
}

function pushHistory(existingValue: any, nextSnapshot: any) {
  const prev = existingValue && typeof existingValue === "object" ? existingValue : null;
  if (!prev) return nextSnapshot;

  const prevCore = JSON.stringify({
    name: prev.name ?? null,
    level: prev.level ?? null,
    stars: prev.stars ?? null,
    power: prev.power ?? null,
    stats: prev.stats ?? null,
  });
  const nextCore = JSON.stringify({
    name: nextSnapshot.name ?? null,
    level: nextSnapshot.level ?? null,
    stars: nextSnapshot.stars ?? null,
    power: nextSnapshot.power ?? null,
    stats: nextSnapshot.stats ?? null,
  });

  if (prevCore === nextCore) return { ...prev, ...nextSnapshot };

  const history = Array.isArray(prev._history) ? prev._history.slice(0) : [];
  history.unshift({
    at: new Date().toISOString(),
    value: prev,
  });

  return { ...prev, ...nextSnapshot, _history: history.slice(0, 50) };
}

export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | {
        upload_id?: number;
        name?: string;
        level?: string | number;
        stars?: string | number;
        power?: string | number;
        // optional stats if your UI sends them (safe if absent)
        attack?: string | number;
        hp?: string | number;
        defense?: string | number;
        march_size?: string | number;
      }
    | null;

  const uploadId = Number(body?.upload_id);
  if (!Number.isFinite(uploadId)) {
    return NextResponse.json({ ok: false, error: "Missing/invalid upload_id" }, { status: 400 });
  }

  const name = normalizeHeroName(body?.name);
  const level = toIntOrNull(body?.level);
  const stars = toIntOrNull(body?.stars);
  const power = toIntOrNull(body?.power);

  const attack = toIntOrNull(body?.attack);
  const hp = toIntOrNull(body?.hp);
  const defense = toIntOrNull(body?.defense);
  const march_size = toIntOrNull(body?.march_size);

  const sb: any = supabaseAdmin();

  // verify upload belongs to this profile
  const up = await sb
    .from("player_uploads")
    .select("id, storage_path")
    .eq("id", uploadId)
    .eq("profile_id", s.profileId)
    .maybeSingle();

  if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  if (!up.data) return NextResponse.json({ ok: false, error: "Upload not found" }, { status: 404 });

  // keep your existing keying scheme so nothing else breaks
  const keyName = (name || `upload_${uploadId}`).trim().toLowerCase();
  const domain = "hero_profile";
  const key = `${s.profileId}:hero:${keyName}`;

  const existing = await sb
    .from("facts")
    .select("id, value")
    .eq("domain", domain)
    .eq("key", key)
    .maybeSingle();

  if (existing.error) return NextResponse.json({ ok: false, error: existing.error.message }, { status: 500 });

  const nextSnapshot = {
    kind: "hero_profile",
    name: name || null,
    level,
    stars,
    power,
    stats: {
      attack,
      hp,
      defense,
      march_size,
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

  // IMPORTANT:
  // Do NOT update player_uploads.facts_id here, because your DB column is BIGINT
  // and facts.id is UUID. That mismatch is what caused your Render error.

  return NextResponse.json({ ok: true, fact_id: fx.data.id });
}
