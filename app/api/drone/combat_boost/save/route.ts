import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";

export const runtime = "nodejs";

function getCookieFromHeader(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) {
      return decodeURIComponent(p.slice(name.length + 1));
    }
  }
  return undefined;
}

async function requireSessionFromReq(req: Request): Promise<{ profileId: string } | null> {
  const token = getCookieFromHeader(req.headers.get("cookie"), sessionCookieName);
  if (!token) return null;

  try {
    const s: any = await verifySession(token);
    return { profileId: String(s.profileId) };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const uploadId = Number(body?.upload_id);
    const value = body?.value;

    if (!Number.isFinite(uploadId) || uploadId <= 0) {
      return NextResponse.json({ error: "Invalid upload_id" }, { status: 400 });
    }

    if (!value || value.kind !== "drone_combat_boost") {
      return NextResponse.json({ error: "Invalid value payload" }, { status: 400 });
    }

    // verify upload belongs to this user
    const { data: upload, error: uploadErr } = await supabaseAdmin
      .from("uploads")
      .select("id, profile_id")
      .eq("id", uploadId)
      .single();

    if (uploadErr || !upload || String(upload.profile_id) !== s.profileId) {
      return NextResponse.json({ error: "Upload not found or not owned" }, { status: 404 });
    }

    const payload = {
      profile_id: s.profileId,
      key: `${s.profileId}:drone:combat_boost:${uploadId}`,
      value: {
        ...value,
        source_upload_id: uploadId,
        saved_at: new Date().toISOString(),
      },
    };

    const { data, error } = await supabaseAdmin
      .from("facts")
      .upsert(payload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, row: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Save failed" }, { status: 500 });
  }
}
