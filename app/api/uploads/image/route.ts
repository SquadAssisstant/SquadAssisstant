import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";
import {
  extractBattleReportPage,
  mergeBattleReportPageIntoParsed,
} from "@/app/api/battle/_lib/extractReport";

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

   let battleReportId: string | null = null;
  let battleReportPageId: string | null = null;

  if (kind === "battle_report") {
    const requestedReportId = String(form.get("report_id") ?? "").trim();

    if (requestedReportId) {
      const reportCheck = await sb
        .from("battle_reports")
        .select("id, raw_storage_path")
        .eq("id", requestedReportId)
        .eq("profile_id", s.profileId)
        .single();

      if (reportCheck.error || !reportCheck.data) {
        return NextResponse.json(
          { ok: false, error: "Battle report not found for this profile" },
          { status: 404 }
        );
      }

      battleReportId = reportCheck.data.id;

      if (!reportCheck.data.raw_storage_path) {
        const reportUpdate = await sb
          .from("battle_reports")
          .update({ raw_storage_path: storagePath })
          .eq("id", battleReportId)
          .eq("profile_id", s.profileId);

        if (reportUpdate.error) {
          return NextResponse.json(
            { ok: false, error: reportUpdate.error.message },
            { status: 500 }
          );
        }
      }
    } else {
      const reportCreate = await sb
        .from("battle_reports")
        .insert({
          profile_id: s.profileId,
          raw_storage_path: storagePath,
        })
        .select("id")
        .single();

      if (reportCreate.error) {
        return NextResponse.json(
          { ok: false, error: reportCreate.error.message },
          { status: 500 }
        );
      }

      battleReportId = reportCreate.data.id;
    }

    const existingPages = await sb
      .from("battle_report_pages")
      .select("id", { count: "exact", head: true })
      .eq("report_id", battleReportId);

    if (existingPages.error) {
      return NextResponse.json(
        { ok: false, error: existingPages.error.message },
        { status: 500 }
      );
    }

    const pageIndex = existingPages.count ?? 0;

    const pageInsert = await sb
      .from("battle_report_pages")
      .insert({
        report_id: battleReportId,
        profile_id: s.profileId,
        storage_bucket: bucket,
        storage_path: storagePath,
        page_index: pageIndex,
        mime: file.type,
        bytes: buf.length,
        sha256,
      })
      .select("id")
      .single();

    if (pageInsert.error) {
      return NextResponse.json(
        { ok: false, error: pageInsert.error.message },
        { status: 500 }
      );
    }

    battleReportPageId = pageInsert.data.id;

    if (battleReportId && battleReportPageId) {
  try {
    const extractedPage = await extractBattleReportPage({
      imageBuffer: buf,
      mimeType: file.type,
      pageIndex,
    });

    await mergeBattleReportPageIntoParsed({
      supabase: sb,
      profileId: s.profileId,
      reportId: battleReportId,
      pageId: battleReportPageId,
      pageIndex,
      extractedPage,
    });
  } catch (e: any) {
    console.error("Battle report extraction failed", e);
  }
    
  }
  
      return NextResponse.json({
    ok: true,
    id: ins.data.id,
    kind: ins.data.kind,
    storage_path: ins.data.storage_path,
    created_at: ins.data.created_at,
    report_id: battleReportId,
    page_id: battleReportPageId,
  });
}
