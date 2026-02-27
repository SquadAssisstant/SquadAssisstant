import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";

export const runtime = "nodejs";

function getCookieFromHeader(
  cookieHeader: string | null,
  name: string
): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
  }
  return undefined;
}

async function requireSessionFromReq(
  req: Request
): Promise<{ profileId: string } | null> {
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

  // If effectively identical, just merge
  const prevCore = JSON.stringify({
    name: prev.name ?? null,
    level: prev.level ?? null,
    stars: prev.stars ?? null,
    power: prev.power ?? null,
  });
  const nextCore = JSON.stringify({
    name: nextSnapshot.name ?? null,
    level: nextSnapshot.level ?? null,
    stars: nextSnapshot.stars ?? null,
    power: nextSnapshot.power ?? null,
  });

  if (prevCore === nextCore) return { ...prev, ...nextSnapshot };

  const history = Array.isArray(prev._history) ? prev._history.slice(0) : [];
  history.unshift({
    at: new Date().toISOString(),
    value: {
      name: prev.name ?? null,
      level: prev.level ?? null,
      stars: prev.stars ?? null,
      power: prev.power ?? null,
      source: prev.source ?? null,
      source_upload_id: prev.source_upload_id ?? null,
      extracted_at: prev.extracted_at ?? null,
      saved_at: prev.saved_at ?? null,
    },
  });

  // keep bounded so row doesn't grow forever
  const bounded = history.slice(0, 50);

  return { ...prev, ...nextSnapshot, _history: bounded };
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

  const sb: any = supabaseAdmin();

  // Verify upload belongs to user (and get existing facts_id + storage_path for source_urls)
  const up = await sb
    .from("player_uploads")
    .select("id, storage_path, facts_id")
    .eq("id", uploadId)
    .eq("profile_id", s.profileId)
    .maybeSingle();

  if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  if (!up.data) return NextResponse.json({ ok: false, error: "Upload not found" }, { status: 404 });

  // Build "next" snapshot
  const nextSnapshot = {
    kind: "hero_profile",
    name: name || null,
    level,
    stars,
    power,
    source_upload_id: uploadId,
    saved_at: new Date().toISOString(),
    source: { upload_id: uploadId, manual: true },
  };

  // === KEY FIX: Use existing facts_id as stable identity when available ===
  // This prevents "rename hero" from accidentally creating a new facts row
  // (which looks like overwrite not working).
  let domain = "hero_profile";
  let key = "";

  let existingFact: { id: any; domain: string; key: string; value: any } | null = null;

  if (up.data.facts_id) {
    const byId = await sb
      .from("facts")
      .select("id, domain, key, value")
      .eq("id", up.data.facts_id)
      .maybeSingle();

    if (byId.error) {
      return NextResponse.json({ ok: false, error: byId.error.message }, { status: 500 });
    }

    if (byId.data) {
      existingFact = byId.data;
      domain = String(byId.data.domain || domain);
      key = String(byId.data.key || "");
    }
  }

  // If no existing fact via facts_id, fall back to the original keying scheme
  if (!key) {
    const keyName = (name || `upload_${uploadId}`).trim().toLowerCase();
    domain = "hero_profile";
    key = `${s.profileId}:hero:${keyName}`;

    const byKey = await sb
      .from("facts")
      .select("id, domain, key, value")
      .eq("domain", domain)
      .eq("key", key)
      .maybeSingle();

    if (byKey.error) {
      return NextResponse.json({ ok: false, error: byKey.error.message }, { status: 500 });
    }
    existingFact = byKey.data ?? null;
  }

  const mergedValue = pushHistory(existingFact?.value, nextSnapshot);

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

  if (fx.error) {
    return NextResponse.json({ ok: false, error: fx.error.message }, { status: 500 });
  }

  // Always link upload -> facts_id (ensures modal loads deterministic current fact)
  const link = await sb
    .from("player_uploads")
    .update({ facts_id: fx.data.id })
    .eq("id", uploadId)
    .eq("profile_id", s.profileId);

  if (link.error) {
    return NextResponse.json({ ok: false, error: link.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, fact_id: fx.data.id });
}
