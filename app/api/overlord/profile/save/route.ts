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
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function normalizeName(v: unknown) {
  const s = String(v ?? "").trim();
  return s ? s : "";
}

function pushHistory(existingValue: any, nextSnapshot: any) {
  const prev = existingValue && typeof existingValue === "object" ? existingValue : null;
  if (!prev) return nextSnapshot;

  const prevCore = JSON.stringify({
    name: prev.name ?? null,
    role: prev.role ?? null,
    tier_badge: prev.tier_badge ?? null,
    level: prev.level ?? null,
    power: prev.power ?? null,
    stats: prev.stats ?? null,
    skill_preview: prev.skill_preview ?? null,
  });
  const nextCore = JSON.stringify({
    name: nextSnapshot.name ?? null,
    role: nextSnapshot.role ?? null,
    tier_badge: nextSnapshot.tier_badge ?? null,
    level: nextSnapshot.level ?? null,
    power: nextSnapshot.power ?? null,
    stats: nextSnapshot.stats ?? null,
    skill_preview: nextSnapshot.skill_preview ?? null,
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
        value?: any;
      }
    | null;

  const uploadId = Number(body?.upload_id);
  if (!Number.isFinite(uploadId)) {
    return NextResponse.json({ ok: false, error: "Missing/invalid upload_id" }, { status: 400 });
  }

  if (!body?.value || body.value.kind !== "overlord_profile") {
    return NextResponse.json({ ok: false, error: "value.kind must be overlord_profile" }, { status: 400 });
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

  const domain = "overlord_profile";
  const key = `${s.profileId}:overlord_profile:upload_${uploadId}`;

  const existing = await sb
    .from("facts")
    .select("id, value")
    .eq("domain", domain)
    .eq("key", key)
    .maybeSingle();

  if (existing.error) return NextResponse.json({ ok: false, error: existing.error.message }, { status: 500 });

  const rawPreview = Array.isArray(body?.value?.skill_preview) ? body.value.skill_preview : [];

  const nextSnapshot = {
    kind: "overlord_profile",
    name: normalizeName(body?.value?.name) || null,
    role: normalizeName(body?.value?.role) || null,
    tier_badge: toIntOrNull(body?.value?.tier_badge),
    level: toIntOrNull(body?.value?.level),
    power: toIntOrNull(body?.value?.power),
    stats: {
      attack: toIntOrNull(body?.value?.stats?.attack),
      hp: toIntOrNull(body?.value?.stats?.hp),
      defense: toIntOrNull(body?.value?.stats?.defense),
      march_size: toIntOrNull(body?.value?.stats?.march_size),
    },
    skill_preview: rawPreview.map((s: any, idx: number) => ({
      slot: toIntOrNull(s?.slot) ?? idx + 1,
      level: toIntOrNull(s?.level),
      stars: toIntOrNull(s?.stars),
      name: normalizeName(s?.name) || null,
    })),
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
