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

function clampStr(v: any, max = 300): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

type BranchType = "attack" | "defense" | "hp";

function emptyBranch(type: BranchType) {
  return {
    type,
    name: null as string | null,
    level: null as number | null,
    hero_bonus: {
      stat: null as string | null,
      current: null as number | null,
      next: null as number | null,
    },
    overlord_bonus: {
      stat: null as string | null,
      current: null as number | null,
      next: null as number | null,
    },
    requirements: [
      { item_index: 1, current: null as number | null, required: null as number | null },
      { item_index: 2, current: null as number | null, required: null as number | null },
    ],
  };
}

function normalizeBranch(type: BranchType, src: any) {
  const base = emptyBranch(type);
  return {
    type,
    name: clampStr(src?.name, 120),
    level: toIntOrNull(src?.level),
    hero_bonus: {
      stat: clampStr(src?.hero_bonus?.stat, 80),
      current: toIntOrNull(src?.hero_bonus?.current),
      next: toIntOrNull(src?.hero_bonus?.next),
    },
    overlord_bonus: {
      stat: clampStr(src?.overlord_bonus?.stat, 80),
      current: toIntOrNull(src?.overlord_bonus?.current),
      next: toIntOrNull(src?.overlord_bonus?.next),
    },
    requirements: Array.isArray(src?.requirements)
      ? src.requirements.slice(0, 2).map((r: any, idx: number) => ({
          item_index: toIntOrNull(r?.item_index) ?? idx + 1,
          current: toIntOrNull(r?.current),
          required: toIntOrNull(r?.required),
        }))
      : base.requirements,
  };
}

function pushHistory(existingValue: any, nextSnapshot: any) {
  const prev = existingValue && typeof existingValue === "object" ? existingValue : null;
  if (!prev) return nextSnapshot;

  const prevCore = JSON.stringify({
    bond_title: prev.bond_title ?? null,
    power: prev.power ?? null,
    selected_branch: prev.selected_branch ?? null,
    branches: prev.branches ?? null,
    note: prev.note ?? null,
  });
  const nextCore = JSON.stringify({
    bond_title: nextSnapshot.bond_title ?? null,
    power: nextSnapshot.power ?? null,
    selected_branch: nextSnapshot.selected_branch ?? null,
    branches: nextSnapshot.branches ?? null,
    note: nextSnapshot.note ?? null,
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

  if (!body?.value || body.value.kind !== "overlord_train") {
    return NextResponse.json({ ok: false, error: "value.kind must be overlord_train" }, { status: 400 });
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

  const domain = "overlord_train";
  const key = `${s.profileId}:overlord_train:upload_${uploadId}`;

  const existing = await sb
    .from("facts")
    .select("id, value")
    .eq("domain", domain)
    .eq("key", key)
    .maybeSingle();

  if (existing.error) return NextResponse.json({ ok: false, error: existing.error.message }, { status: 500 });

  const nextSnapshot = {
    kind: "overlord_train",
    bond_title: clampStr(body?.value?.bond_title, 120),
    power: toIntOrNull(body?.value?.power),
    selected_branch:
      body?.value?.selected_branch === "attack" ||
      body?.value?.selected_branch === "defense" ||
      body?.value?.selected_branch === "hp"
        ? body.value.selected_branch
        : null,
    branches: {
      attack: normalizeBranch("attack", body?.value?.branches?.attack),
      defense: normalizeBranch("defense", body?.value?.branches?.defense),
      hp: normalizeBranch("hp", body?.value?.branches?.hp),
    },
    note: clampStr(body?.value?.note, 300),
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
