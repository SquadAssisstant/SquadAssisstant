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

function sanitizeForHistory(value: any) {
  if (!value || typeof value !== "object") return value;
  const { _history, ...rest } = value;
  return rest;
}

function stableStringifyCore(v: any) {
  // Compare the major sections; if unchanged, don't add history
  const core = {
    power_total: v?.power_total ?? null,
    level: v?.level ?? null,
    critical_upgrade_stage: v?.critical_upgrade_stage ?? null,
    attributes_panel: v?.attributes_panel ?? null,
    components: v?.components ?? null,
    extra_attributes: v?.extra_attributes ?? null,
    combat_boost: v?.combat_boost ?? null,
    skill_chip: v?.skill_chip ?? null,
    sources: v?.sources ?? null,
  };
  return JSON.stringify(core);
}

function mergeNonNull(target: any, patch: any) {
  const out = { ...(target && typeof target === "object" ? target : {}) };
  for (const [k, v] of Object.entries(patch || {})) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) out[k] = v;
    else if (typeof v === "object") out[k] = mergeNonNull(out[k], v);
    else out[k] = v;
  }
  return out;
}

export async function POST(req: Request) {
  const sess = await requireSessionFromReq(req);
  if (!sess) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { upload_id?: unknown; extracted?: any }
    | null;

  const uploadId = typeof body?.upload_id === "number" ? body.upload_id : Number(body?.upload_id);
  const extracted = body?.extracted;

  if (!Number.isFinite(uploadId)) {
    return NextResponse.json({ ok: false, error: "Missing/invalid upload_id" }, { status: 400 });
  }
  if (!extracted || typeof extracted !== "object") {
    return NextResponse.json({ ok: false, error: "Missing extracted payload" }, { status: 400 });
  }

  const section = String(extracted.section || "unknown");
  if (
    !["attributes", "components", "extra_attributes", "combat_boost", "skill_chip", "unknown"].includes(section)
  ) {
    return NextResponse.json({ ok: false, error: `Invalid section: ${section}` }, { status: 400 });
  }

  const sb: any = supabaseAdmin();

  // Verify upload ownership + kind
  const up = await sb
    .from("player_uploads")
    .select("id, kind, storage_path")
    .eq("id", uploadId)
    .eq("profile_id", sess.profileId)
    .maybeSingle();

  if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  if (!up.data) return NextResponse.json({ ok: false, error: "Upload not found" }, { status: 404 });

  const kind = String(up.data.kind || "");
  if (kind !== "drone") {
    return NextResponse.json({ ok: false, error: `Upload kind must be "drone" (got "${kind}")` }, { status: 400 });
  }

  const key = `${sess.profileId}:drone`;
  const nowIso = new Date().toISOString();

  const existing = await sb
    .from("facts")
    .select("id, value")
    .eq("domain", "drone")
    .eq("key", key)
    .eq("created_by_profile_id", sess.profileId)
    .maybeSingle();

  if (existing.error) return NextResponse.json({ ok: false, error: existing.error.message }, { status: 500 });

  const prevValue = existing.data?.value ?? null;
  const prevHistory = Array.isArray(prevValue?._history) ? prevValue._history : [];

  const base = prevValue && typeof prevValue === "object" ? sanitizeForHistory(prevValue) : {};

  const patch: any = { kind: "drone", saved_at: nowIso };

  // Put extracted values into correct section(s)
  if (section === "attributes") {
    patch.power_total = extracted.power_total ?? null;
    patch.level = extracted.level ?? null;
    patch.critical_upgrade_stage = extracted.critical_upgrade_stage ?? null;
    patch.attributes_panel = extracted.attributes_panel ?? null;
  } else if (section === "components") {
    patch.power_total = extracted.power_total ?? null; // sometimes present
    patch.components = extracted.components ?? null;
  } else if (section === "extra_attributes") {
    patch.power_total = extracted.power_total ?? null;
    patch.extra_attributes = extracted.extra_attributes ?? null;
  } else if (section === "combat_boost") {
    patch.power_total = extracted.power_total ?? null;
    patch.combat_boost = extracted.combat_boost ?? null;
  } else if (section === "skill_chip") {
    patch.power_total = extracted.power_total ?? null;
    patch.skill_chip = extracted.skill_chip ?? null;
  }

  patch.sources = mergeNonNull(base.sources, {
    last_upload_id: uploadId,
    screens: { [section]: uploadId },
  });

  const merged = mergeNonNull(base, patch);

  // History: only if core changed
  let newHistory = prevHistory;
  if (prevValue && stableStringifyCore(prevValue) !== stableStringifyCore(merged)) {
    newHistory = [{ at: nowIso, value: sanitizeForHistory(prevValue) }, ...prevHistory].slice(0, 50);
  }

  const finalValue = { ...merged, _history: newHistory };

  const fx = await sb
    .from("facts")
    .upsert(
      {
        domain: "drone",
        key,
        value: finalValue,
        status: "confirmed",
        confidence: 1.0,
        source_urls: up.data.storage_path ? [up.data.storage_path] : [],
        created_by_profile_id: sess.profileId,
        updated_at: nowIso,
      },
      { onConflict: "domain,key" }
    )
    .select("id, domain, key, value, status, confidence, source_urls, created_at, updated_at")
    .single();

  if (fx.error) return NextResponse.json({ ok: false, error: fx.error.message }, { status: 500 });

  return NextResponse.json({ ok: true, fact: fx.data });
                                                }
