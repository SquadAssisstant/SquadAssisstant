import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";

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

function safeExtFromMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "bin";
}

function normalizeKind(kindRaw: string) {
  // Match your frontend kinds + your current backend mapping behavior
  const k = (kindRaw || "").trim();
  if (!k) return "unknown";

  if (k === "hero_skills") return "hero_profile";
  // allow these
  const allowed = new Set([
    "battle_report",
    "hero_profile",
    "drone",
    "overlord",
    "gear",
    "unknown",
  ]);
  return allowed.has(k) ? k : "unknown";
}

export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const kindRaw = String(form.get("kind") ?? "");
  const kind = normalizeKind(kindRaw);

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });
  }
  if (!file.type?.startsWith("image/")) {
    return NextResponse.json({ ok: false, error: "Only image uploads supported" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buf = Buffer.from(bytes);

  // sha for dedupe/debug
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");

  const bucket = "uploads";
  const ext = safeExtFromMime(file.type);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = crypto.randomBytes(6).toString("hex");

  // Storage path design: uploads/<profileId>/<kind>/<timestamp>_<rand>.<ext>
  const storagePath = `${s.profileId}/${kind}/${ts}_${rand}.${ext}`;

  const sb: any = supabaseAdmin();

  // 1) upload to storage
  const up = await sb.storage.from(bucket).upload(storagePath, buf, {
    contentType: file.type,
    upsert: false,
  });

  if (up.error) {
    return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  }

  // 2) insert pointer row
  const ins = await sb
    .from("player_uploads")
    .insert({
      profile_id: s.profileId,
      kind,
      storage_bucket: bucket,
      storage_path: storagePath,
      mime_type: file.type,
      bytes: buf.length,
      sha256,
    })
    .select("id, storage_path, kind, created_at")
    .single();

  if (ins.error) {
    // If DB insert fails, optionally you could delete the storage object
    // to avoid orphan files. For now, keep it simple:
    return NextResponse.json(
      { ok: false, error: `Uploaded file but failed to save DB row: ${ins.error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    id: ins.data.id,
    kind: ins.data.kind,
    storage_path: ins.data.storage_path,
    created_at: ins.data.created_at,
  });
}
