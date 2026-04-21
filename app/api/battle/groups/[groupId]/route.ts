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

export async function PATCH(req: Request, ctx: { params: Promise<{ groupId: string }> }) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { groupId: rawGroupId } = await ctx.params;
  const groupId = Number(rawGroupId);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Invalid group id" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        label?: unknown;
        note?: unknown;
        upload_ids?: unknown;
      }
    | null;

  const sb: any = supabaseAdmin();

  const existing = await sb
    .from("battle_report_groups")
    .select("id, profile_id")
    .eq("id", groupId)
    .eq("profile_id", s.profileId)
    .maybeSingle();

  if (existing.error) {
    return NextResponse.json({ ok: false, error: existing.error.message }, { status: 500 });
  }
  if (!existing.data) {
    return NextResponse.json({ ok: false, error: "Group not found" }, { status: 404 });
  }

  const patch: any = {};
  if (body && "label" in body) {
    const label = cleanLabel(body.label);
    if (!label) return NextResponse.json({ ok: false, error: "label cannot be empty" }, { status: 400 });
    patch.label = label;
  }
  if (body && "note" in body) {
    patch.note = cleanNote(body.note);
  }

  if (Object.keys(patch).length) {
    const updateRes = await sb
      .from("battle_report_groups")
      .update(patch)
      .eq("id", groupId)
      .eq("profile_id", s.profileId);

    if (updateRes.error) {
      return NextResponse.json({ ok: false, error: updateRes.error.message }, { status: 500 });
    }
  }

  if (body && "upload_ids" in body) {
    const uploadIds = normalizeUploadIds(body.upload_ids);

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

    const deleteRes = await sb.from("battle_report_group_items").delete().eq("group_id", groupId);
    if (deleteRes.error) {
      return NextResponse.json({ ok: false, error: deleteRes.error.message }, { status: 500 });
    }

    if (uploadIds.length) {
      const insertRes = await sb.from("battle_report_group_items").insert(
        uploadIds.map((uploadId, idx) => ({
          group_id: groupId,
          upload_id: uploadId,
          position: idx,
        }))
      );

      if (insertRes.error) {
        return NextResponse.json({ ok: false, error: insertRes.error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ groupId: string }> }) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { groupId: rawGroupId } = await ctx.params;
  const groupId = Number(rawGroupId);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Invalid group id" }, { status: 400 });
  }

  const sb: any = supabaseAdmin();

  const delRes = await sb
    .from("battle_report_groups")
    .delete()
    .eq("id", groupId)
    .eq("profile_id", s.profileId);

  if (delRes.error) {
    return NextResponse.json({ ok: false, error: delRes.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
