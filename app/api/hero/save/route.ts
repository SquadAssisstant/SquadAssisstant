import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";

function getCookieFromHeader(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
  }
  return undefined;
}

async function requireSessionFromReq(req: Request) {
  const token = getCookieFromHeader(req.headers.get("cookie"), sessionCookieName());
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

function normalizeHeroKey(raw: unknown) {
  const s = String(raw ?? "").trim();
  // keep it simple; you can expand later (slugify, etc.)
  return s.toLowerCase();
}

function safeNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

type SaveBody = {
  upload_id?: number | string;
  hero_key?: string;
  level?: number | string | null;
  stars?: number | string | null;
  notes?: string | null;
  gear?: any;
  skills?: any;

  // optional attachment ids (if you implement this later)
  gear_upload_ids?: number[];
  skills_upload_ids?: number[];
};

export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as SaveBody | null;
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });

  const uploadIdRaw = body.upload_id;
  const upload_id =
    uploadIdRaw === null || uploadIdRaw === undefined ? null : Number(uploadIdRaw);

  const hero_key = normalizeHeroKey(body.hero_key);
  if (!hero_key) {
    return NextResponse.json({ ok: false, error: "hero_key is required" }, { status: 400 });
  }
  if (upload_id !== null && !Number.isFinite(upload_id)) {
    return NextResponse.json({ ok: false, error: "upload_id must be a number" }, { status: 400 });
  }

  const level = safeNumber(body.level);
  const stars = safeNumber(body.stars);

  const sb: any = supabaseAdmin();

  // If upload_id provided, ensure it belongs to the user.
  if (upload_id !== null) {
    const chk = await sb
      .from("player_uploads")
      .select("id")
      .eq("id", upload_id)
      .eq("profile_id", s.profileId)
      .maybeSingle();

    if (chk.error) return NextResponse.json({ ok: false, error: chk.error.message }, { status: 500 });
    if (!chk.data) return NextResponse.json({ ok: false, error: "Upload not found" }, { status: 404 });
  }

  const domain = "hero";

  const nextValue = {
    hero_key,
    level,
    stars,
    notes: typeof body.notes === "string" ? body.notes : body.notes ?? null,
    gear: body.gear ?? null,
    skills: body.skills ?? null,
    gear_upload_ids: Array.isArray(body.gear_upload_ids) ? body.gear_upload_ids : [],
    skills_upload_ids: Array.isArray(body.skills_upload_ids) ? body.skills_upload_ids : [],
  };

  // ✅ The important part: UPSERT by (domain, key)
  const up = await sb
    .from("facts")
    .upsert(
      {
        domain,
        key: hero_key,
        value: nextValue,
        status: "active",
        confidence: 1,
        created_by_profile_id: s.profileId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "domain,key" }
    )
    .select("id")
    .single();

  if (up.error) {
    return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  }

  const facts_id = up.data.id as string;

  // Optional: link upload → facts_id so /api/hero/details can find it quickly
  if (upload_id !== null) {
    const link = await sb
      .from("player_uploads")
      .update({ facts_id })
      .eq("id", upload_id)
      .eq("profile_id", s.profileId);

    // Don't hard-fail if the column isn't present or update fails.
    // But if it fails for a normal reason, bubble it up.
    if (link?.error) {
      // If your schema definitely has facts_id, you can choose to fail here.
      // For now: return success for facts, but report link error.
      return NextResponse.json({
        ok: true,
        facts_id,
        warning: `Saved facts but failed to link upload: ${link.error.message}`,
      });
    }
  }

  return NextResponse.json({ ok: true, facts_id });
}
