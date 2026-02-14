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
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file field 'file'" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Only images supported" }, { status: 400 });

  const pageIndexRaw = form.get("pageIndex");
  const pageIndex = pageIndexRaw ? Number(pageIndexRaw) : 0;

  const buf = Buffer.from(await file.arrayBuffer());
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");

  const ext = guessExtFromMime(file.type);
  const baseName = safePathSegment(file.name || "page");
  const objectPath = `profiles/${s.profileId}/battle_reports/${reportId}/${String(pageIndex).padStart(2, "0")}_${sha256.slice(
    0,
    10
  )}_${baseName}.${ext}`;

  const sb = supabaseAdmin();

  // Upload to storage
  const up = await sb.storage.from("uploads").upload(objectPath, buf, {
    contentType: file.type,
    upsert: false,
  });

  if (up.error) {
    // If it's already there, we still want to dedupe gracefully.
    // But storage errors vary; keep it simple for now.
    return NextResponse.json({ error: up.error.message }, { status: 500 });
  }

  // Insert page record (dedupe via unique index on report_id+sha256)
  const ins = await sb
    .from("battle_report_pages")
    .insert({
      report_id: reportId,
      profile_id: s.profileId,
      storage_bucket: "uploads",
      storage_path: objectPath,
      page_index: Number.isFinite(pageIndex) ? pageIndex : 0,
      sha256,
      mime: file.type,
      bytes: buf.length,
    })
    .select("id")
    .single();

  if (ins.error) {
    // Likely duplicate page. Treat as OK and return deduped.
    return NextResponse.json({ ok: true, deduped: true, sha256, storagePath: objectPath });
  }

  return NextResponse.json({ ok: true, pageId: ins.data.id, sha256, storagePath: objectPath });
}
