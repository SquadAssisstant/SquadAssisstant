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

function cleanMode(v: unknown): string {
  return String(v ?? "balanced").trim().slice(0, 80) || "balanced";
}

function cleanLockedHeroes(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return Array.from(
    new Set(
      v
        .map((x) => String(x ?? "").trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 50)
    )
  );
}

function cleanSquadCount(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(4, Math.trunc(n)));
}

export async function GET(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const sb: any = supabaseAdmin();
  const url = new URL(req.url);

  const savedId = Number(url.searchParams.get("saved_id") || "");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 250);

  if (Number.isFinite(savedId)) {
    const one = await sb
      .from("optimizer_saved_runs")
      .select("id, profile_id, label, mode, squad_count, locked_heroes, result, note, created_at, updated_at")
      .eq("id", savedId)
      .eq("profile_id", s.profileId)
      .maybeSingle();

    if (one.error) {
      return NextResponse.json({ ok: false, error: one.error.message }, { status: 500 });
    }
    if (!one.data) {
      return NextResponse.json({ ok: false, error: "Saved optimizer file not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      saved: one.data,
    });
  }

  const many = await sb
    .from("optimizer_saved_runs")
    .select("id, profile_id, label, mode, squad_count, locked_heroes, note, created_at, updated_at")
    .eq("profile_id", s.profileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (many.error) {
    return NextResponse.json({ ok: false, error: many.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    files: many.data ?? [],
  });
}

export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        label?: unknown;
        note?: unknown;
        mode?: unknown;
        squad_count?: unknown;
        locked_heroes?: unknown;
        result?: unknown;
      }
    | null;

  const label = cleanLabel(body?.label);
  const note = cleanNote(body?.note);
  const mode = cleanMode(body?.mode);
  const squad_count = cleanSquadCount(body?.squad_count);
  const locked_heroes = cleanLockedHeroes(body?.locked_heroes);
  const result = body?.result ?? null;

  if (!label) {
    return NextResponse.json({ ok: false, error: "label is required" }, { status: 400 });
  }
  if (!result || typeof result !== "object") {
    return NextResponse.json({ ok: false, error: "result is required" }, { status: 400 });
  }

  const sb: any = supabaseAdmin();

  const ins = await sb
    .from("optimizer_saved_runs")
    .insert({
      profile_id: s.profileId,
      label,
      note,
      mode,
      squad_count,
      locked_heroes,
      result,
    })
    .select("id, profile_id, label, mode, squad_count, locked_heroes, note, created_at, updated_at")
    .single();

  if (ins.error) {
    return NextResponse.json({ ok: false, error: ins.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    saved: ins.data,
  });
}
