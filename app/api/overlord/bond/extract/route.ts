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

function clampStr(v: any, max = 400): string | null {
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
      { ok: false, error: `Unsupported kind "${String(up.data.kind)}" for overlord bond extract` },
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
      current_title: { type: ["string", "null"] },
      current_rank: { type: ["string", "null"] },
      next_rank: { type: ["string", "null"] },

      tiers: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            order: { type: ["integer", "null"] },
            title: { type: ["string", "null"] },
            is_current: { type: ["boolean", "null"] },
            is_unlocked: { type: ["boolean", "null"] },
            requirement_text: { type: ["string", "null"] },
          },
          required: ["order", "title", "is_current", "is_unlocked", "requirement_text"],
        },
      },

      squad_attack_base_raw: { type: ["string", "null"] },
      squad_attack_increase_raw: { type: ["string", "null"] },
      squad_defense_base_raw: { type: ["string", "null"] },
      squad_defense_increase_raw: { type: ["string", "null"] },
      squad_hp_base_raw: { type: ["string", "null"] },
      squad_hp_increase_raw: { type: ["string", "null"] },

      hp_boost_current_raw: { type: ["string", "null"] },
      hp_boost_next_raw: { type: ["string", "null"] },
      attack_boost_current_raw: { type: ["string", "null"] },
      attack_boost_next_raw: { type: ["string", "null"] },
      defense_boost_current_raw: { type: ["string", "null"] },
      defense_boost_next_raw: { type: ["string", "null"] },
      resistance_current_raw: { type: ["string", "null"] },
      resistance_next_raw: { type: ["string", "null"] },
      march_size_current: { type: ["integer", "null"] },
      march_size_next: { type: ["integer", "null"] },

      cost_current: { type: ["integer", "null"] },
      cost_required: { type: ["integer", "null"] },
      requirement_note: { type: ["string", "null"] },

      notes: { type: ["string", "null"] },
    },
    required: [
      "current_title",
      "current_rank",
      "next_rank",
      "tiers",
      "squad_attack_base_raw",
      "squad_attack_increase_raw",
      "squad_defense_base_raw",
      "squad_defense_increase_raw",
      "squad_hp_base_raw",
      "squad_hp_increase_raw",
      "hp_boost_current_raw",
      "hp_boost_next_raw",
      "attack_boost_current_raw",
      "attack_boost_next_raw",
      "defense_boost_current_raw",
      "defense_boost_next_raw",
      "resistance_current_raw",
      "resistance_next_raw",
      "march_size_current",
      "march_size_next",
      "cost_current",
      "cost_required",
      "requirement_note",
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
            "Extract overlord bond/rating values from a mobile game bond rating screen. " +
            "Return ONLY the JSON object matching the schema. " +
            "If a value is not visible, return null and explain briefly in notes.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "From this OVERLORD BOND RATING screen, extract the current bond title, current and next rank symbols if visible, " +
                "the visible tier ladder entries with current/unlocked state and requirement text, the squad extra bonus values, " +
                "the overlord special bonus current and next values, the promotion cost, and any requirement note shown on screen.",
            },
            { type: "input_image", image_url: imageUrl, detail: "high" },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "overlord_bond_extract",
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

    const tiers = Array.isArray(parsed?.tiers)
      ? parsed.tiers.map((t: any, idx: number) => ({
          order: toIntOrNull(t?.order) ?? idx + 1,
          title: clampStr(t?.title, 120),
          is_current: typeof t?.is_current === "boolean" ? t.is_current : false,
          is_unlocked: typeof t?.is_unlocked === "boolean" ? t.is_unlocked : false,
          requirement_text: clampStr(t?.requirement_text, 200),
        }))
      : [];

    const extracted = {
      kind: "overlord_bond" as const,
      current_title: clampStr(parsed?.current_title, 120),
      current_rank: clampStr(parsed?.current_rank, 20),
      next_rank: clampStr(parsed?.next_rank, 20),
      tiers,
      squad_bonus: {
        attack: {
          base: parseCompactNumber(clampStr(parsed?.squad_attack_base_raw, 40)),
          increase: parseCompactNumber(clampStr(parsed?.squad_attack_increase_raw, 40)),
        },
        defense: {
          base: parseCompactNumber(clampStr(parsed?.squad_defense_base_raw, 40)),
          increase: parseCompactNumber(clampStr(parsed?.squad_defense_increase_raw, 40)),
        },
        hp: {
          base: parseCompactNumber(clampStr(parsed?.squad_hp_base_raw, 40)),
          increase: parseCompactNumber(clampStr(parsed?.squad_hp_increase_raw, 40)),
        },
      },
      overlord_bonus: {
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
        resistance: {
          current: parsePercent(clampStr(parsed?.resistance_current_raw, 40)),
          next: parsePercent(clampStr(parsed?.resistance_next_raw, 40)),
        },
        march_size: {
          current: toIntOrNull(parsed?.march_size_current),
          next: toIntOrNull(parsed?.march_size_next),
        },
      },
      cost: {
        current: toIntOrNull(parsed?.cost_current),
        required: toIntOrNull(parsed?.cost_required),
      },
      requirement_note: clampStr(parsed?.requirement_note, 300),
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
