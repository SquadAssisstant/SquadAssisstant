import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function cleanLabel(v: unknown): string {
  return String(v ?? "").trim().slice(0, 120);
}

function cleanNote(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, 1000) : null;
}

function normalizeUploadIds(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  const ids = v
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0)
    .map((n) => Math.trunc(n));
  return Array.from(new Set(ids));
}

export async function GET(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const sb: any = supabaseAdmin();
  const url = new URL(req.url);
  const groupId = Number(url.searchParams.get("group_id") || "");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 500);

  if (Number.isFinite(groupId)) {
    const groupRes = await sb
      .from("battle_report_groups")
      .select("id, profile_id, label, note, created_at, updated_at")
      .eq("id", groupId)
      .eq("profile_id", s.profileId)
      .maybeSingle();

    if (groupRes.error) {
      return NextResponse.json({ ok: false, error: groupRes.error.message }, { status: 500 });
    }
    if (!groupRes.data) {
      return NextResponse.json({ ok: false, error: "Group not found" }, { status: 404 });
    }

    const itemsRes = await sb
      .from("battle_report_group_items")
      .select(`
        id,
        group_id,
        upload_id,
        position,
        created_at,
        player_uploads:upload_id (
          id,
          kind,
          created_at,
          storage_bucket,
          storage_path
        )
      `)
      .eq("group_id", groupId)
      .order("position", { ascending: true })
      .order("id", { ascending: true });

    if (itemsRes.error) {
      return NextResponse.json({ ok: false, error: itemsRes.error.message }, { status: 500 });
    }

    const items = [];
    for (const row of itemsRes.data ?? []) {
      const up = Array.isArray(row.player_uploads) ? row.player_uploads[0] : row.player_uploads;
      let url: string | null = null;
      if (up?.storage_path) {
        const bucket = up.storage_bucket || "uploads";
        const signed = await sb.storage.from(bucket).createSignedUrl(up.storage_path, 60 * 60);
        url = signed?.data?.signedUrl ?? null;
      }

      items.push({
        id: row.id,
        group_id: row.group_id,
        upload_id: row.upload_id,
        position: row.position,
        created_at: row.created_at,
        upload: up
          ? {
              id: up.id,
              kind: up.kind,
              created_at: up.created_at,
              storage_path: up.storage_path,
              url,
            }
          : null,
      });
    }

    return NextResponse.json({
      ok: true,
      group: groupRes.data,
      items,
    });
  }

  const groupsRes = await sb
    .from("battle_report_groups")
    .select("id, profile_id, label, note, created_at, updated_at")
    .eq("profile_id", s.profileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (groupsRes.error) {
    return NextResponse.json({ ok: false, error: groupsRes.error.message }, { status: 500 });
  }

  const groups = [];
  for (const group of groupsRes.data ?? []) {
    const countRes = await sb
      .from("battle_report_group_items")
      .select("id", { count: "exact", head: true })
      .eq("group_id", group.id);

    groups.push({
      ...group,
      item_count: countRes.count ?? 0,
    });
  }

  return NextResponse.json({
    ok: true,
    groups,
  });
}

export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | {
        label?: unknown;
        note?: unknown;
        upload_ids?: unknown;
      }
    | null;

  const label = cleanLabel(body?.label);
  const note = cleanNote(body?.note);
  const uploadIds = normalizeUploadIds(body?.upload_ids);

  if (!label) {
    return NextResponse.json({ ok: false, error: "label is required" }, { status: 400 });
  }
  if (!uploadIds.length) {
    return NextResponse.json({ ok: false, error: "upload_ids is required" }, { status: 400 });
  }

  const sb: any = supabaseAdmin();

  const uploadsRes = await sb
    .from("player_uploads")
    .select("id, kind, profile_id")
    .in("id", uploadIds)
    .eq("profile_id", s.profileId);

  if (uploadsRes.error) {
    return NextResponse.json({ ok: false, error: uploadsRes.error.message }, { status: 500 });
  }

  const uploads = Array.isArray(uploadsRes.data) ? uploadsRes.data : [];
  if (uploads.length !== uploadIds.length) {
    return NextResponse.json({ ok: false, error: "One or more uploads were not found" }, { status: 400 });
  }

  const bad = uploads.find((u: any) => String(u.kind) !== "battle_report");
  if (bad) {
    return NextResponse.json({ ok: false, error: "All uploads in a battle group must be kind battle_report" }, { status: 400 });
  }

  const groupRes = await sb
    .from("battle_report_groups")
    .insert({
      profile_id: s.profileId,
      label,
      note,
    })
    .select("id, profile_id, label, note, created_at, updated_at")
    .single();

  if (groupRes.error) {
    return NextResponse.json({ ok: false, error: groupRes.error.message }, { status: 500 });
  }

  const items = uploadIds.map((uploadId, idx) => ({
    group_id: groupRes.data.id,
    upload_id: uploadId,
    position: idx,
  }));

  const itemsRes = await sb
    .from("battle_report_group_items")
    .insert(items)
    .select("id, group_id, upload_id, position, created_at");

  if (itemsRes.error) {
    return NextResponse.json({ ok: false, error: itemsRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    group: groupRes.data,
    items: itemsRes.data ?? [],
  });
}
