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

function toFloatOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function clampStr(v: any, max = 400): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function pushHistory(existingValue: any, nextSnapshot: any) {
  const prev = existingValue && typeof existingValue === "object" ? existingValue : null;
  if (!prev) return nextSnapshot;

  const prevCore = JSON.stringify({
    current_title: prev.current_title ?? null,
    current_rank: prev.current_rank ?? null,
    next_rank: prev.next_rank ?? null,
    tiers: prev.tiers ?? null,
    squad_bonus: prev.squad_bonus ?? null,
    overlord_bonus: prev.overlord_bonus ?? null,
    cost: prev.cost ?? null,
    requirement_note: prev.requirement_note ?? null,
  });
  const nextCore = JSON.stringify({
    current_title: nextSnapshot.current_title ?? null,
    current_rank: nextSnapshot.current_rank ?? null,
    next_rank: nextSnapshot.next_rank ?? null,
    tiers: nextSnapshot.tiers ?? null,
    squad_bonus: nextSnapshot.squad_bonus ?? null,
    overlord_bonus: nextSnapshot.overlord_bonus ?? null,
    cost: nextSnapshot.cost ?? null,
    requirement_note: nextSnapshot.requirement_note ?? null,
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

  if (!body?.value || body.value.kind !== "overlord_bond") {
    return NextResponse.json({ ok: false, error: "value.kind must be overlord_bond" }, { status: 400 });
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

  const domain = "overlord_bond";
  const key = `${s.profileId}:overlord_bond:upload_${uploadId}`;

  const existing = await sb
    .from("facts")
    .select("id, value")
    .eq("domain", domain)
    .eq("key", key)
    .maybeSingle();

  if (existing.error) return NextResponse.json({ ok: false, error: existing.error.message }, { status: 500 });

  const rawTiers = Array.isArray(body?.value?.tiers) ? body.value.tiers : [];

  const nextSnapshot = {
    kind: "overlord_bond",
    current_title: clampStr(body?.value?.current_title, 120),
    current_rank: clampStr(body?.value?.current_rank, 20),
    next_rank: clampStr(body?.value?.next_rank, 20),
    tiers: rawTiers.map((t: any, idx: number) => ({
      order: toIntOrNull(t?.order) ?? idx + 1,
      title: clampStr(t?.title, 120),
      is_current: !!t?.is_current,
      is_unlocked: !!t?.is_unlocked,
      requirement_text: clampStr(t?.requirement_text, 200),
    })),
    squad_bonus: {
      attack: {
        base: toIntOrNull(body?.value?.squad_bonus?.attack?.base),
        increase: toIntOrNull(body?.value?.squad_bonus?.attack?.increase),
      },
      defense: {
        base: toIntOrNull(body?.value?.squad_bonus?.defense?.base),
        increase: toIntOrNull(body?.value?.squad_bonus?.defense?.increase),
      },
      hp: {
        base: toIntOrNull(body?.value?.squad_bonus?.hp?.base),
        increase: toIntOrNull(body?.value?.squad_bonus?.hp?.increase),
      },
    },
    overlord_bonus: {
      hp_boost: {
        current: toFloatOrNull(body?.value?.overlord_bonus?.hp_boost?.current),
        next: toFloatOrNull(body?.value?.overlord_bonus?.hp_boost?.next),
      },
      attack_boost: {
        current: toFloatOrNull(body?.value?.overlord_bonus?.attack_boost?.current),
        next: toFloatOrNull(body?.value?.overlord_bonus?.attack_boost?.next),
      },
      defense_boost: {
        current: toFloatOrNull(body?.value?.overlord_bonus?.defense_boost?.current),
        next: toFloatOrNull(body?.value?.overlord_bonus?.defense_boost?.next),
      },
      resistance: {
        current: toFloatOrNull(body?.value?.overlord_bonus?.resistance?.current),
        next: toFloatOrNull(body?.value?.overlord_bonus?.resistance?.next),
      },
      march_size: {
        current: toIntOrNull(body?.value?.overlord_bonus?.march_size?.current),
        next: toIntOrNull(body?.value?.overlord_bonus?.march_size?.next),
      },
    },
    cost: {
      current: toIntOrNull(body?.value?.cost?.current),
      required: toIntOrNull(body?.value?.cost?.required),
    },
    requirement_note: clampStr(body?.value?.requirement_note, 300),
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
