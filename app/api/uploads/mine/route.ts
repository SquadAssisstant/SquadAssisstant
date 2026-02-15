import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";

function getCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return undefined;
  return cookieHeader
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(name + "="))
    ?.slice(name.length + 1);
}

async function requireSession(req: Request) {
  const token = getCookie(req.headers.get("cookie"), sessionCookieName());
  if (!token) return null;
  try {
    return await verifySession(decodeURIComponent(token));
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const s = await requireSession(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind"); // optional filter

  const sb = supabaseAdmin() as any;

  let q = sb
    .from("battle_reports")
    .select("id, created_at, consent_scope, raw_storage_path, parsed")
    .eq("profile_id", s.profileId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (kind) q = q.contains("parsed", { kind });

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Don’t return raw timestamps if you don’t want them surfaced:
  const sanitized = (data ?? []).map((r: any) => ({
    id: r.id,
    consent_scope: r.consent_scope,
    raw_storage_path: r.raw_storage_path,
    parsed: r.parsed,
  }));

  return NextResponse.json({ ok: true, items: sanitized });
}
