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

/**
 * Privacy scrub:
 * - remove timestamps (created_at / updated_at and EXIF dates)
 * - remove GPS/location
 * - remove any profile identifiers embedded in parsed payload
 */
function scrubParsed(parsed: any) {
  if (!parsed || typeof parsed !== "object") return parsed;

  const clone = JSON.parse(JSON.stringify(parsed));

  // Remove EXIF GPS + date-ish fields if present
  if (clone.exif && typeof clone.exif === "object") {
    const ex = clone.exif;

    // GPS-like keys
    delete ex.GPSLatitude;
    delete ex.GPSLongitude;
    delete ex.GPSAltitude;
    delete ex.GPSLatitudeRef;
    delete ex.GPSLongitudeRef;
    delete ex.GPSPosition;
    delete ex.gps;
    delete ex.GPS;

    // Timestamp-like keys
    delete ex.DateTimeOriginal;
    delete ex.CreateDate;
    delete ex.ModifyDate;
    delete ex.DateTimeDigitized;
    delete ex.OffsetTimeOriginal;
    delete ex.OffsetTimeDigitized;
    delete ex.OffsetTime;
  }

  // Remove any accidental identity fields if they ever appear
  if (clone.identity && typeof clone.identity === "object") {
    delete clone.identity;
  }
  if (clone.location && typeof clone.location === "object") {
    delete clone.location;
  }

  return clone;
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = ctx.params.id;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const sb: any = supabaseAdmin();

  const { data, error } = await sb
    .from("battle_reports")
    .select("id, profile_id, consent_scope, raw_storage_path, parsed")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Enforce ownership (no cross-user access)
  if (data.profile_id !== s.profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsedScrubbed = scrubParsed(data.parsed);

  // Note: we do NOT return profile_id, created_at, updated_at, or any timestamps.
  return NextResponse.json({
    ok: true,
    report: {
      id: data.id,
      consent_scope: data.consent_scope ?? "private",
      raw_storage_path: data.raw_storage_path ?? null,
      parsed: parsedScrubbed,
    },
  });
}
