import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";

export const runtime = "nodejs";

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

function isOverlordKind(kind: unknown) {
  const k = String(kind ?? "").trim().toLowerCase();
  return ["overlord", "lord", "over_lord"].includes(k);
}

function clampStr(v: any, max = 300): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function toIntOrNull(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  const s = String(v ?? "").replace(/[^\d]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parsePercent(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(String(raw).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  const sess = await requireSessionFromReq(req);
  if (!sess) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { upload_id?: unknown } | null;
  const uploadId = typeof body?.upload_id === "number" ? body.upload_id : Number(body?.upload_id);

  if (!Number.isFinite(uploadId)) {
    return NextResponse.json({ ok: false, error: "Missing/invalid upload_id" }, { status: 400 });
  }

  const sb: any = supabaseAdmin();

  const up = await sb
    .from("player_uploads")
    .select("id, kind, storage_bucket, storage_path")
    .eq("id", uploadId)
    .eq("profile_id", sess.profileId)
    .maybeSingle();

  if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  if (!up.data) return NextResponse.json({ ok: false, error: "Upload not found" }, { status: 404 });
  if (!isOverlordKind(up.data.kind)) {
    return NextResponse.json(
      { ok: false, error: `Unsupported kind "${String(up.data.kind)}" for overlord promote extract` },
      { status: 400 }
    );
  }

  const bucket = up.data.storage_bucket || "uploads";
  const path = String(up.data.storage_path || "");
  if (!path) return NextResponse.json({ ok: false, error: "Upload has no storage_path" }, { status: 500 });

  const signed = await sb.storage.from(bucket).createSignedUrl(path, 60 * 10);
  if (signed.error) return NextResponse.json({ ok: false, error: signed.error.message }, { status: 500 });

  const imageUrl = signed.data?.signedUrl;
  if (!imageUrl) return NextResponse.json({ ok: false, error: "Could not sign image URL" }, { status: 500 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: "OPENAI_API_KEY missing" }, { status: 500 });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      hp_current: { type: ["integer", "null"] },
      hp_next: { type: ["integer", "null"] },
      attack_current: { type: ["integer", "null"] },
      attack_next: { type: ["integer", "null"] },
      defense_current: { type: ["integer", "null"] },
      defense_next: { type: ["integer", "null"] },

      hp_boost_current_raw: { type: ["string", "null"] },
      hp_boost_next_raw: { type: ["string", "null"] },
      attack_boost_current_raw: { type: ["string", "null"] },
      attack_boost_next_raw: { type: ["string", "null"] },
      defense_boost_current_raw: { type: ["string", "null"] },
      defense_boost_next_raw: { type: ["string", "null"] },

      requirement_1_current: { type: ["integer", "null"] },
      requirement_1_required: { type: ["integer", "null"] },
      requirement_2_current: { type: ["integer", "null"] },
      requirement_2_required: { type: ["integer", "null"] },
      requirement_3_current: { type: ["integer", "null"] },
      requirement_3_required: { type: ["integer", "null"] },

      notes: { type: ["string", "null"] },
    },
    required: [
      "hp_current",
      "hp_next",
      "attack_current",
      "attack_next",
      "defense_current",
      "defense_next",
      "hp_boost_current_raw",
      "hp_boost_next_raw",
      "attack_boost_current_raw",
      "attack_boost_next_raw",
      "defense_boost_current_raw",
      "defense_boost_next_raw",
      "requirement_1_current",
      "requirement_1_required",
      "requirement_2_current",
      "requirement_2_required",
      "requirement_3_current",
      "requirement_3_required",
      "notes",
    ],
  } as const;

  try {
    const resp = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "Extract overlord promote values from a mobile game promote screen. " +
            "Return ONLY the JSON object matching the schema. " +
            "If a value is not visible, return null and explain briefly in notes.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "From this OVERLORD PROMOTE screen, extract the current and next values for HP, Attack, and Defense. " +
                "Also extract the current and next values for HP Boost, Attack Boost, and Defense Boost. " +
                "Then extract the three requirement counters as current/required values. " +
                "If there are warning or upgrade notes, place them in notes.",
            },
            { type: "input_image", image_url: imageUrl, detail: "high" },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "overlord_promote_extract",
          strict: true,
          schema,
        },
      },
      temperature: 0,
    });

    const raw = resp.output_text ?? "";
    if (!raw) return NextResponse.json({ ok: false, error: "Model returned empty output" }, { status: 500 });

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: false, error: "Model did not return valid JSON", raw }, { status: 500 });
    }

    const extracted = {
      kind: "overlord_promote" as const,
      stat_upgrades: {
        hp: {
          current: toIntOrNull(parsed?.hp_current),
          next: toIntOrNull(parsed?.hp_next),
        },
        attack: {
          current: toIntOrNull(parsed?.attack_current),
          next: toIntOrNull(parsed?.attack_next),
        },
        defense: {
          current: toIntOrNull(parsed?.defense_current),
          next: toIntOrNull(parsed?.defense_next),
        },
      },
      boosts: {
        hp_boost: {
          current: parsePercent(clampStr(parsed?.hp_boost_current_raw, 40)),
          next: parsePercent(clampStr(parsed?.hp_boost_next_raw, 40)),
        },
        attack_boost: {
          current: parsePercent(clampStr(parsed?.attack_boost_current_raw, 40)),
          next: parsePercent(clampStr(parsed?.attack_boost_next_raw, 40)),
        },
        defense_boost: {
          current: parsePercent(clampStr(parsed?.defense_boost_current_raw, 40)),
          next: parsePercent(clampStr(parsed?.defense_boost_next_raw, 40)),
        },
      },
      requirements: [
        {
          item_index: 1,
          current: toIntOrNull(parsed?.requirement_1_current),
          required: toIntOrNull(parsed?.requirement_1_required),
        },
        {
          item_index: 2,
          current: toIntOrNull(parsed?.requirement_2_current),
          required: toIntOrNull(parsed?.requirement_2_required),
        },
        {
          item_index: 3,
          current: toIntOrNull(parsed?.requirement_3_current),
          required: toIntOrNull(parsed?.requirement_3_required),
        },
      ],
      source_upload_id: uploadId,
      notes: clampStr(parsed?.notes, 500),
    };

    return NextResponse.json({ ok: true, extracted });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Extract failed", debug: { name: e?.name, code: e?.code } },
      { status: 500 }
    );
  }
      }
