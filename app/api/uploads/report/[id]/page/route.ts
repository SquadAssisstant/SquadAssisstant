import { NextResponse } from "next/server";
import crypto from "crypto";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";
import { guessExtFromMime, safePathSegment } from "@/lib/upload";

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

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const s = await requireSession(req);

  if (!s) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: reportId } = await ctx.params;
  const sb = supabaseAdmin() as any;

  const reportCheck = await sb
    .from("battle_reports")
    .select("id, profile_id, raw_storage_path")
    .eq("id", reportId)
    .eq("profile_id", s.profileId)
    .single();

  if (reportCheck.error || !reportCheck.data) {
    return NextResponse.json(
      { error: "Battle report not found" },
      { status: 404 }
    );
  }

  const form = await req.formData().catch(() => null);

  if (!form) {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 }
    );
  }

  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing file field named 'file'" },
      { status: 400 }
    );
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image uploads supported" },
      { status: 400 }
    );
  }

  const rawIndex = form.get("pageIndex");
  const pageIndex = Number(rawIndex);

  if (!Number.isInteger(pageIndex) || pageIndex < 0) {
    return NextResponse.json(
      { error: "Missing/invalid pageIndex" },
      { status: 400 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const bytes = buf.byteLength;
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
  const ext = guessExtFromMime(file.type);
  const uuid = crypto.randomUUID();
  const baseName = safePathSegment(file.name || `page_${pageIndex}`);

  const storageBucket = "uploads";
  const storagePath = `profiles/${s.profileId}/battle_report/${reportId}/${pageIndex}_${uuid}_${baseName}.${ext}`;

  const up = await sb.storage.from(storageBucket).upload(storagePath, buf, {
    contentType: file.type,
    upsert: false,
  });

  if (up.error) {
    return NextResponse.json({ error: up.error.message }, { status: 500 });
  }

  const pageIns = await sb
    .from("battle_report_pages")
    .insert({
      report_id: reportId,
      profile_id: s.profileId,
      storage_bucket: storageBucket,
      storage_path: storagePath,
      page_index: pageIndex,
      sha256,
      mime: file.type,
      bytes,
    })
    .select("id")
    .single();

  if (pageIns.error) {
    return NextResponse.json({ error: pageIns.error.message }, { status: 500 });
  }

  const uploadIns = await sb
    .from("player_uploads")
    .insert({
      profile_id: s.profileId,
      kind: "battle_report",
      storage_bucket: storageBucket,
      storage_path: storagePath,
      original_name: file.name || `battle_report_page_${pageIndex}.${ext}`,
      mime_type: file.type,
      bytes,
      sha256,
      meta: {
        report_id: reportId,
        battle_report_page_id: pageIns.data.id,
        page_index: pageIndex,
      },
    })
    .select("id")
    .single();

  if (uploadIns.error) {
    return NextResponse.json({ error: uploadIns.error.message }, { status: 500 });
  }

  if (pageIndex === 0 || !reportCheck.data.raw_storage_path) {
    const reportUpdate = await sb
      .from("battle_reports")
      .update({
        raw_storage_path: storagePath,
      })
      .eq("id", reportId)
      .eq("profile_id", s.profileId);

    if (reportUpdate.error) {
      return NextResponse.json(
        { error: reportUpdate.error.message },
        { status: 500 }
      );
    }
  }

    return NextResponse.json({
    ok: true,
    reportId,
    pageId: pageIns.data.id,
    uploadId: uploadIns.data.id,
    pageIndex,
    sha256,
    storagePath,
    bytes,
    mime: file.type,
  });
}
