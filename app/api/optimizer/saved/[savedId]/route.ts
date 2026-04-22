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
  return s ? s.slice(0, 1500) : null;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ savedId: string }> }) {
  const s = await requireSessionFromReq(req);
  if (!s) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { savedId: rawSavedId } = await ctx.params;
  const savedId = Number(rawSavedId);
  if (!Number.isFinite(savedId)) {
    return NextResponse.json({ ok: false, error: "Invalid saved optimizer file id" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        label?: unknown;
        note?: unknown;
      }
    | null;

  const patch: any = {};
  if (body && "label" in body) {
    const label = cleanLabel(body.label);
    if (!label) {
      return NextResponse.json({ ok: false, error: "label cannot be empty" }, { status: 400 });
    }
    patch.label = label;
  }
  if (body && "note" in body) {
    patch.note = cleanNote(body.note);
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
  }

  const sb: any = supabaseAdmin();

  const upd = await sb
    .from("optimizer_saved_runs")
    .update(patch)
    .eq("id", savedId)
    .eq("profile_id", s.profileId)
    .select("id, profile_id, label, mode, squad_count, locked_heroes, note, created_at, updated_at")
    .maybeSingle();

  if (upd.error) {
    return NextResponse.json({ ok: false, error: upd.error.message }, { status: 500 });
  }
  if (!upd.data) {
    return NextResponse.json({ ok: false, error: "Saved optimizer file not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    saved: upd.data,
  });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ savedId: string }> }) {
  const s = await requireSessionFromReq(req);
  if (!s) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { savedId: rawSavedId } = await ctx.params;
  const savedId = Number(rawSavedId);
  if (!Number.isFinite(savedId)) {
    return NextResponse.json({ ok: false, error: "Invalid saved optimizer file id" }, { status: 400 });
  }

  const sb: any = supabaseAdmin();

  const del = await sb
    .from("optimizer_saved_runs")
    .delete()
    .eq("id", savedId)
    .eq("profile_id", s.profileId);

  if (del.error) {
    return NextResponse.json({ ok: false, error: del.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
