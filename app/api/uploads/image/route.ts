import { NextResponse } from "next/server";
import { sessionCookieName, verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
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

const UploadKind = ["hero_profile", "battle_report", "drone", "overlord", "gear", "unknown"] as const;
type UploadKind = (typeof UploadKind)[number];

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

function normalizeKind(input: unknown): UploadKind {
  if (!input) return "unknown";
  const v = String(input).trim().toLowerCase();
  return (UploadKind as readonly string[]).includes(v) ? (v as UploadKind) : "unknown";
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

  const declaredKind = normalizeKind(form.get("kind"));

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = guessExtFromMime(file.type);

  const uuid = crypto.randomUUID();
  const baseName = safePathSegment(file.name || "upload");
  const objectPath = `profiles/${s.profileId}/images/${uuid}_${baseName}.${ext}`;

  // ✅ IMPORTANT: cast to any to avoid the "never" .from typing in production builds
  const sb = supabaseAdmin() as any;

  const upload = await sb.storage.from("uploads").upload(objectPath, buf, {
    contentType: file.type,
    upsert: false,
  });

  if (upload.error) {
    return NextResponse.json({ error: upload.error.message }, { status: 500 });
  }

  let meta: any = null;
  try {
    meta = await exifr.parse(buf, { tiff: true, exif: true, xmp: true, gps: true, icc: false, iptc: false });
  } catch {
    meta = null;
  }

  const provenance = classifyProvenance(meta, { mime: file.type, size: file.size, name: file.name || "" });

  const kind = declaredKind;
  const kindConfidence = declaredKind === "unknown" ? 0.2 : 1.0;
  const kindSignals =
    declaredKind === "unknown" ? ["No declared kind provided"] : ["User-declared upload kind"];

  const parsed = {
    upload: {
      filename: file.name,
      mime: file.type,
      size: file.size,
      storageBucket: "uploads",
      storagePath: objectPath,
    },
    provenance,
    kind,
    kindConfidence,
    kindSignals,
    declaredKind: declaredKind === "unknown" ? null : declaredKind,
    status: "uploaded",
  };

  // This is still writing into battle_reports (as your current setup does).
  // We'll split this later when we implement 14-page battle report containers.
  const ins = await sb
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

  return NextResponse.json({
    ok: true,
    reportId: ins.data.id,
    storagePath: objectPath,
    kind,
    kindConfidence,
    provenance,
    allowedKinds: UploadKind,
  });
}
