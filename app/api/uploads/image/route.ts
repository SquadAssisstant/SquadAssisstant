import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";
import { guessExtFromMime, safePathSegment } from "@/lib/upload";
import * as exifr from "exifr";

function getCookieFromHeader(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
  }
  return undefined;
}

async function requireSessionFromReq(req: Request) {
  const token = getCookieFromHeader(req.headers.get("cookie"), sessionCookieName());
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

type Provenance = "screenshot" | "camera_photo" | "web_image" | "ai_or_edited" | "unknown";

function classifyProvenance(meta: any, file: { mime: string; size: number; name: string }) {
  const hasCameraMake = !!meta?.Make || !!meta?.Model;
  const hasSoftware = typeof meta?.Software === "string" && meta.Software.length > 0;
  const hasDate = !!meta?.DateTimeOriginal || !!meta?.CreateDate;

  const nameHint = file.name.toLowerCase().includes("screenshot");

  if (hasCameraMake && hasDate) {
    return { label: "camera_photo" as Provenance, confidence: 0.85, signals: ["EXIF Make/Model", "DateTimeOriginal"] };
  }

  if (!hasCameraMake && (nameHint || hasSoftware)) {
    return {
      label: "screenshot" as Provenance,
      confidence: 0.65,
      signals: ["No camera EXIF", nameHint ? "Filename hint" : "Software tag"],
    };
  }

  const software = (meta?.Software ?? "").toString().toLowerCase();
  const looksEdited = ["photoshop", "lightroom", "snapseed", "canva"].some((k) => software.includes(k));
  if (looksEdited) {
    return { label: "ai_or_edited" as Provenance, confidence: 0.6, signals: ["Editor software tag"] };
  }

  return { label: "unknown" as Provenance, confidence: 0.4, signals: [] as string[] };
}

export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field named 'file'" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image uploads supported for now" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = guessExtFromMime(file.type);

  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");

  const baseName = safePathSegment(file.name || "upload");
  const objectPath = `profiles/${s.profileId}/images/${yyyy}-${mm}-${dd}/${Date.now()}_${baseName}.${ext}`;

  // ✅ Correct: call supabaseAdmin() first
  const upload = await supabaseAdmin()
    .storage
    .from("uploads")
    .upload(objectPath, buf, { contentType: file.type, upsert: false });

  if (upload.error) {
    return NextResponse.json({ error: upload.error.message }, { status: 500 });
  }

  // EXIF/XMP parse (best-effort)
  let meta: any = null;
  try {
    meta = await exifr.parse(buf, { tiff: true, exif: true, xmp: true, gps: true, icc: false, iptc: false });
  } catch {
    meta = null;
  }

  const provenance = classifyProvenance(meta, { mime: file.type, size: file.size, name: file.name || "" });

  const parsed = {
    upload: {
      filename: file.name,
      mime: file.type,
      size: file.size,
      storageBucket: "uploads",
      storagePath: objectPath,
    },
    exif: meta ?? null,
    provenance,
    status: "uploaded",
  };

  // ✅ Correct: call supabaseAdmin() first
  const ins = await supabaseAdmin()
    .from("battle_reports")
    .insert({
      profile_id: s.profileId,
      raw_storage_path: objectPath,
      parsed,
      consent_scope: "private",
    })
    .select("id")
    .single();

  if (ins.error) {
    return NextResponse.json({ error: ins.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reportId: ins.data.id, storagePath: objectPath, provenance });
}
