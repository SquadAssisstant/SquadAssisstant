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

type UploadRow = {
  id: number;
  kind: string;
  storage_bucket: string | null;
  storage_path: string | null;
  created_at: string;
};

function kindAliases(kind: string): string[] {
  const k = (kind || "").trim().toLowerCase();

  if (!k) return [];

  if (k === "hero_profile") {
    return [
      "hero_profile",
      "hero",
      "heroes",
      "profile",
      "hero_profiles",
      "hero_skills", // include legacy hero uploads that may have been grouped together
    ];
  }

  if (k === "drone") {
    return [
      "drone",
      "drone_profile",
      "drone_components",
      "drone_chipset",
      "drone_skill_chips",
      "drone_combat_boost",
    ];
  }

  if (k === "overlord") {
    return ["overlord", "lord", "over_lord"];
  }

  if (k === "battle_report") {
    return ["battle_report", "battle", "report", "battle_reports"];
  }

  if (k === "gear") {
    return ["gear", "equipment"];
  }

  if (k === "hero_skills") {
    return ["hero_skills", "hero_profile", "hero", "heroes"];
  }

  return [k];
}

export async function GET(req: Request) {
  try {
    const s = await requireSessionFromReq(req);
    if (!s) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedKind = (searchParams.get("kind") || "hero_profile").trim();
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 80), 1), 200);

    const sb: any = supabaseAdmin();
    const aliases = kindAliases(requestedKind);

    let query = sb
      .from("player_uploads")
      .select("id, kind, storage_bucket, storage_path, created_at")
      .eq("profile_id", s.profileId)
      .order("id", { ascending: false })
      .limit(limit);

    if (aliases.length === 1) {
      query = query.eq("kind", aliases[0]);
    } else if (aliases.length > 1) {
      query = query.in("kind", aliases);
    }

    const q = await query;

    if (q.error) {
      return NextResponse.json({ ok: false, error: q.error.message }, { status: 500 });
    }

    const rows: UploadRow[] = (q.data ?? []) as UploadRow[];

    const uploads = await Promise.all(
      rows.map(async (r) => {
        const bucket = r.storage_bucket || "uploads";
        const path = r.storage_path || "";
        let url: string | null = null;

        if (path) {
          const signed = await sb.storage.from(bucket).createSignedUrl(path, 60 * 60);
          url = signed?.data?.signedUrl ?? null;
        }

        return {
          id: r.id,
          kind: r.kind,
          created_at: r.created_at,
          storage_path: r.storage_path,
          url,
        };
      })
    );

    return NextResponse.json({
      ok: true,
      requested_kind: requestedKind,
      matched_kinds: aliases,
      uploads,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unexpected server error" },
      { status: 500 }
    );
  }
}
