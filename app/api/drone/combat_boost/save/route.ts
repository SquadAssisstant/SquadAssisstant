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

function isDroneKind(kind: unknown) {
  const k = String(kind ?? "").trim().toLowerCase();
  return [
    "drone",
    "drone_profile",
    "drone_components",
    "drone_chipset",
    "drone_skill_chips",
    "drone_combat_boost",
    "drone_boost_chips",
  ].includes(k);
}

export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);

  if (!s) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  const uploadId = Number(body?.upload_id);
  const value = body?.value;

  if (!Number.isFinite(uploadId)) {
    return NextResponse.json({ ok: false, error: "Missing/invalid upload_id" }, { status: 400 });
  }

  if (!value || value.kind !== "drone_combat_boost") {
    return NextResponse.json(
      { ok: false, error: "Invalid value payload for drone_combat_boost" },
      { status: 400 }
    );
  }

  const sb: any = supabaseAdmin();

  const up = await sb
    .from("player_uploads")
    .select("id, kind, storage_bucket, storage_path")
    .eq("id", uploadId)
    .eq("profile_id", s.profileId)
    .maybeSingle();

  if (up.error) {
    return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  }

  if (!up.data) {
    return NextResponse.json({ ok: false, error: "Upload not found" }, { status: 404 });
  }

  if (!isDroneKind(up.data.kind)) {
    return NextResponse.json(
      { ok: false, error: `Unsupported kind "${String(up.data.kind)}" for drone combat boost save` },
      { status: 400 }
    );
  }

  const payload = {
    ...value,
    source_upload_id: uploadId,
    source_bucket: up.data.storage_bucket ?? null,
    source_path: up.data.storage_path ?? null,
    saved_at: new Date().toISOString(),
  };

  const { data, error } = await sb
    .from("facts")
    .upsert(
      {
        domain: "drone_combat_boost",
        key: `${s.profileId}:drone:combat_boost:${uploadId}`,
        value: payload,
        created_by_profile_id: s.profileId,
        status: "confirmed",
        confidence: 1,
        source_urls: [],
      },
      { onConflict: "key" }
    )
    .select("id, domain, key, value, status, confidence, source_urls, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    row: data,
  });
}
