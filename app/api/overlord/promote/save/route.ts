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
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toFloatOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function pushHistory(existingValue: any, nextSnapshot: any) {
  const prev = existingValue && typeof existingValue === "object" ? existingValue : null;
  if (!prev) return nextSnapshot;

  const prevCore = JSON.stringify({
    stat_upgrades: prev.stat_upgrades ?? null,
    boosts: prev.boosts ?? null,
    requirements: prev.requirements ?? null,
  });
  const nextCore = JSON.stringify({
    stat_upgrades: nextSnapshot.stat_upgrades ?? null,
    boosts: nextSnapshot.boosts ?? null,
    requirements: nextSnapshot.requirements ?? null,
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

  if (!body?.value || body.value.kind !== "overlord_promote") {
    return NextResponse.json({ ok: false, error: "value.kind must be overlord_promote" }, { status: 400 });
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

  const domain = "overlord_promote";
  const key = `${s.profileId}:overlord_promote:upload_${uploadId}`;

  const existing = await sb
    .from("facts")
    .select("id, value")
    .eq("domain", domain)
    .eq("key", key)
    .maybeSingle();

  if (existing.error) return NextResponse.json({ ok: false, error: existing.error.message }, { status: 500 });

  const rawReqs = Array.isArray(body?.value?.requirements) ? body.value.requirements : [];

  const nextSnapshot = {
    kind: "overlord_promote",
    stat_upgrades: {
      hp: {
        current: toIntOrNull(body?.value?.stat_upgrades?.hp?.current),
        next: toIntOrNull(body?.value?.stat_upgrades?.hp?.next),
      },
      attack: {
        current: toIntOrNull(body?.value?.stat_upgrades?.attack?.current),
        next: toIntOrNull(body?.value?.stat_upgrades?.attack?.next),
      },
      defense: {
        current: toIntOrNull(body?.value?.stat_upgrades?.defense?.current),
        next: toIntOrNull(body?.value?.stat_upgrades?.defense?.next),
      },
    },
    boosts: {
      hp_boost: {
        current: toFloatOrNull(body?.value?.boosts?.hp_boost?.current),
        next: toFloatOrNull(body?.value?.boosts?.hp_boost?.next),
      },
      attack_boost: {
        current: toFloatOrNull(body?.value?.boosts?.attack_boost?.current),
        next: toFloatOrNull(body?.value?.boosts?.attack_boost?.next),
      },
      defense_boost: {
        current: toFloatOrNull(body?.value?.boosts?.defense_boost?.current),
        next: toFloatOrNull(body?.value?.boosts?.defense_boost?.next),
      },
    },
    requirements: rawReqs.map((r: any, idx: number) => ({
      item_index: toIntOrNull(r?.item_index) ?? idx + 1,
      current: toIntOrNull(r?.current),
      required: toIntOrNull(r?.required),
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

  return NextResponse.json({ ok: true, fact_id: fx.data.id });
                            }
