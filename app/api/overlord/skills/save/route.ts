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

function clampStr(v: any, max = 1200): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function pushHistory(existingValue: any, nextSnapshot: any) {
  const prev = existingValue && typeof existingValue === "object" ? existingValue : null;
  if (!prev) return nextSnapshot;

  const prevCore = JSON.stringify({
    selected_slot: prev.selected_slot ?? null,
    skills: prev.skills ?? null,
  });
  const nextCore = JSON.stringify({
    selected_slot: nextSnapshot.selected_slot ?? null,
    skills: nextSnapshot.skills ?? null,
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

  if (!body?.value || body.value.kind !== "overlord_skills") {
    return NextResponse.json({ ok: false, error: "value.kind must be overlord_skills" }, { status: 400 });
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

  const domain = "overlord_skills";
  const key = `${s.profileId}:overlord_skills:upload_${uploadId}`;

  const existing = await sb
    .from("facts")
    .select("id, value")
    .eq("domain", domain)
    .eq("key", key)
    .maybeSingle();

  if (existing.error) return NextResponse.json({ ok: false, error: existing.error.message }, { status: 500 });

  const rawSkills = Array.isArray(body?.value?.skills) ? body.value.skills : [];
  const normalizedSkills = rawSkills.map((skill: any, idx: number) => ({
    slot: toIntOrNull(skill?.slot) ?? idx + 1,
    name: clampStr(skill?.name, 120),
    level: toIntOrNull(skill?.level),
    max_level: toIntOrNull(skill?.max_level),
    type: clampStr(skill?.type, 80),
    category: clampStr(skill?.category, 120),
    cooldown: typeof skill?.cooldown === "number" ? skill.cooldown : null,
    description: clampStr(skill?.description, 1200),
    scaling_detail: clampStr(skill?.scaling_detail, 1200),
    bonuses: Array.isArray(skill?.bonuses)
      ? skill.bonuses.map((b: any) => String(b ?? "").trim()).filter(Boolean)
      : [],
    locked_bonuses: Array.isArray(skill?.locked_bonuses)
      ? skill.locked_bonuses.map((b: any) => String(b ?? "").trim()).filter(Boolean)
      : [],
    upgrade_progress:
      skill?.upgrade_progress && typeof skill.upgrade_progress === "object"
        ? {
            current: toIntOrNull(skill.upgrade_progress.current),
            required: toIntOrNull(skill.upgrade_progress.required),
          }
        : null,
    stars: toIntOrNull(skill?.stars),
  }));

  const nextSnapshot = {
    kind: "overlord_skills",
    selected_slot: toIntOrNull(body?.value?.selected_slot),
    skills: normalizedSkills,
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
