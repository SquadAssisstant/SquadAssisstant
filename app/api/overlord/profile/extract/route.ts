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

function clampStr(v: any, max = 160): string | null {
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

function parseCompactNumber(raw: string | null): number | null {
  if (!raw) return null;
  const s0 = raw.trim().replace(/,/g, "");
  if (!s0) return null;

  const m = s0.match(/^(\d+(\.\d+)?)([KkMm])?$/);
  if (!m) {
    const n = Number(s0);
    return Number.isFinite(n) ? n : null;
  }

  const base = Number(m[1]);
  if (!Number.isFinite(base)) return null;

  const suffix = (m[3] || "").toUpperCase();
  if (suffix === "K") return Math.round(base * 1_000);
  if (suffix === "M") return Math.round(base * 1_000_000);
  return Math.round(base);
}

type PreviewSkill = {
  slot: number;
  level: number | null;
  stars: number | null;
  name: string | null;
};

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
      { ok: false, error: `Unsupported kind "${String(up.data.kind)}" for overlord profile extract` },
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
      name: { type: ["string", "null"] },
      role: { type: ["string", "null"] },
      tier_badge: { type: ["integer", "null"] },
      level: { type: ["integer", "null"] },
      power_raw: { type: ["string", "null"] },
      attack_raw: { type: ["string", "null"] },
      hp_raw: { type: ["string", "null"] },
      defense_raw: { type: ["string", "null"] },
      march_size_raw: { type: ["string", "null"] },
      skill_preview: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            slot: { type: ["integer", "null"] },
            level: { type: ["integer", "null"] },
            stars: { type: ["integer", "null"] },
            name: { type: ["string", "null"] },
          },
          required: ["slot", "level", "stars", "name"],
        },
      },
      notes: { type: ["string", "null"] },
    },
    required: [
      "name",
      "role",
      "tier_badge",
      "level",
      "power_raw",
      "attack_raw",
      "hp_raw",
      "defense_raw",
      "march_size_raw",
      "skill_preview",
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
            "Extract overlord overview/profile values from a mobile game screenshot. " +
            "Return ONLY the JSON object matching the schema. " +
            "If a value is not visible, return null and explain briefly in notes.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "From this OVERLORD OVERVIEW screen, extract the overlord name, role/class, tier badge number, level, overall power, " +
                "and the four visible stats: Attack, HP, Defense, March Size. " +
                "Also extract the visible skill preview strip as ordered slots with level and star count. " +
                "If skill names are not visible, return null for the preview names.",
            },
            { type: "input_image", image_url: imageUrl, detail: "high" },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "overlord_profile_extract",
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

    const previewRaw = Array.isArray(parsed?.skill_preview) ? parsed.skill_preview : [];
    const skill_preview: PreviewSkill[] = previewRaw.slice(0, 5).map((s: any, idx: number) => ({
      slot: toIntOrNull(s?.slot) ?? idx + 1,
      level: toIntOrNull(s?.level),
      stars: toIntOrNull(s?.stars),
      name: clampStr(s?.name, 120),
    }));

    const extracted = {
      kind: "overlord_profile" as const,
      name: clampStr(parsed?.name, 120),
      role: clampStr(parsed?.role, 80),
      tier_badge: toIntOrNull(parsed?.tier_badge),
      level: toIntOrNull(parsed?.level),
      power: parseCompactNumber(clampStr(parsed?.power_raw, 40)) ?? 0,
      stats: {
        attack: parseCompactNumber(clampStr(parsed?.attack_raw, 40)) ?? 0,
        hp: parseCompactNumber(clampStr(parsed?.hp_raw, 40)) ?? 0,
        defense: parseCompactNumber(clampStr(parsed?.defense_raw, 40)) ?? 0,
        march_size: toIntOrNull(parsed?.march_size_raw) ?? 0,
        attack_raw: clampStr(parsed?.attack_raw, 40),
        hp_raw: clampStr(parsed?.hp_raw, 40),
        defense_raw: clampStr(parsed?.defense_raw, 40),
        march_size_raw: clampStr(parsed?.march_size_raw, 40),
        power_raw: clampStr(parsed?.power_raw, 40),
      },
      skill_preview,
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
