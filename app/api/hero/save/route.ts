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

export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { upload_id?: number; name?: string; level?: string | number; stars?: string | number; power?: string | number }
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

  // Verify upload belongs to user
  const up = await sb
    .from("player_uploads")
    .select("id, storage_path")
    .eq("id", uploadId)
    .eq("profile_id", s.profileId)
    .maybeSingle();

  if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  if (!up.data) return NextResponse.json({ ok: false, error: "Upload not found" }, { status: 404 });

  const keyName = (name || `upload_${uploadId}`).trim().toLowerCase();
  const domain = "hero_profile";
  const key = `${s.profileId}:hero:${keyName}`;

  const value = {
    kind: "hero_profile",
    name: name || null,
    level,
    stars,
    power,
    source: { upload_id: uploadId, manual: true },
  };

  const fx = await sb
    .from("facts")
    .upsert(
      {
        domain,
        key,
        value,
        status: "confirmed",
        confidence: 1.0,
        source_urls: [up.data.storage_path],
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

  // Link upload -> facts
  const link = await sb
    .from("player_uploads")
    .update({ facts_id: fx.data.id })
    .eq("id", uploadId)
    .eq("profile_id", s.profileId);

  if (link.error) {
    return NextResponse.json({ ok: false, error: link.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
