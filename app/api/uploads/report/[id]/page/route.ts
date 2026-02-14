import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";
import { guessExtFromMime, safePathSegment } from "@/lib/upload";
import crypto from "crypto";

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

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await requireSession(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: reportId } = await ctx.params;

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field named 'file'" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image uploads supported" }, { status: 400 });
  }

  const rawIndex = form.get("pageIndex");
  const pageIndex = Number(rawIndex);
  if (!Number.isInteger(pageIndex) || pageIndex < 0) {
    return NextResponse.json({ error: "Missing/invalid pageIndex" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const bytes = buf.byteLength;
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
  const ext = guessExtFromMime(file.type);

  const uuid = crypto.randomUUID();
  const baseName = safePathSegment(file.name || `page_${pageIndex}`);
  const storageBucket = "uploads";
  const storagePath = `profiles/${s.profileId}/reports/${reportId}/${pageIndex}_${uuid}_${baseName}.${ext}`;

  // ✅ critical: cast to any so .from() doesn't type-collapse to never
  const sb = supabaseAdmin() as any;

  // Upload to storage
  const up = await sb.storage.from(storageBucket).upload(storagePath, buf, {
    contentType: file.type,
    upsert: false,
  });

  if (up.error) {
    return NextResponse.json({ error: up.error.message }, { status: 500 });
  }

  // Insert page record (dedupe via unique index on report_id+sha256 if you added it)
  const ins = await sb
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

  // If duplicate (unique constraint), return success but indicate deduped
  if (ins.error) {
    const msg = String(ins.error.message || "");
    const code = String(ins.error.code || "");
    const looksDuplicate =
      code === "23505" || msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique");

    if (looksDuplicate) {
      return NextResponse.json({
        ok: true,
        reportId,
        pageIndex,
        sha256,
        storagePath,
        deduped: true,
      });
    }

    return NextResponse.json({ error: ins.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    reportId,
    pageId: ins.data.id,
    pageIndex,
    sha256,
    storagePath,
    bytes,
    mime: file.type,
  });
}
