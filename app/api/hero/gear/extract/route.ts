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

function isHeroKind(kind: unknown) {
  const k = String(kind ?? "").trim().toLowerCase();
  return ["hero_profile", "hero_skills", "hero_gear", "hero"].includes(k);
}

function clampStr(v: any, max = 180): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function toIntOrNull(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const s = v.replace(/[, ]/g, "").trim();
    if (!s) return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
  }
  return null;
}

function parseBoostNumeric(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(String(raw).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

type GearSlotKey = "weapon" | "data_chip" | "armor" | "radar";

const gearSlots: GearSlotKey[] = ["weapon", "data_chip", "armor", "radar"];

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
  if (!isHeroKind(up.data.kind)) {
    return NextResponse.json(
      { ok: false, error: `Unsupported kind "${String(up.data.kind)}" for hero gear extract` },
      { status: 400 }
    );
  }

  const bucket = up.data.storage_bucket || "uploads";
  const path = String(up.data.storage_path || "");
  if (!path) return NextResponse.json({ ok: false, error: "Upload has no storage_path" }, { status: 500 });

  const signed = await sb.storage.from(bucket).createSignedUrl(path, 60 * 10);
  if (signed.error) return NextResponse.json({ ok: false, error: signed.error.message }, { status: 500 });

  const imageUrl: string = signed.data?.signedUrl;
  if (!imageUrl) return NextResponse.json({ ok: false, error: "Could not sign image URL" }, { status: 500 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: "OPENAI_API_KEY missing" }, { status: 500 });

  const client = new OpenAI({ apiKey });

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      weapon: {
        type: ["object", "null"],
        additionalProperties: false,
        properties: {
          item_name: { type: ["string", "null"] },
          stars: { type: ["integer", "null"] },
          level: { type: ["integer", "null"] },
          rarity: { type: ["string", "null"] },
          boosts: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                stat: { type: ["string", "null"] },
                value_raw: { type: ["string", "null"] },
              },
              required: ["stat", "value_raw"],
            },
          },
          notes: { type: ["string", "null"] },
        },
        required: ["item_name", "stars", "level", "rarity", "boosts", "notes"],
      },
      data_chip: {
        type: ["object", "null"],
        additionalProperties: false,
        properties: {
          item_name: { type: ["string", "null"] },
          stars: { type: ["integer", "null"] },
          level: { type: ["integer", "null"] },
          rarity: { type: ["string", "null"] },
          boosts: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                stat: { type: ["string", "null"] },
                value_raw: { type: ["string", "null"] },
              },
              required: ["stat", "value_raw"],
            },
          },
          notes: { type: ["string", "null"] },
        },
        required: ["item_name", "stars", "level", "rarity", "boosts", "notes"],
      },
      armor: {
        type: ["object", "null"],
        additionalProperties: false,
        properties: {
          item_name: { type: ["string", "null"] },
          stars: { type: ["integer", "null"] },
          level: { type: ["integer", "null"] },
          rarity: { type: ["string", "null"] },
          boosts: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                stat: { type: ["string", "null"] },
                value_raw: { type: ["string", "null"] },
              },
              required: ["stat", "value_raw"],
            },
          },
          notes: { type: ["string", "null"] },
        },
        required: ["item_name", "stars", "level", "rarity", "boosts", "notes"],
      },
      radar: {
        type: ["object", "null"],
        additionalProperties: false,
        properties: {
          item_name: { type: ["string", "null"] },
          stars: { type: ["integer", "null"] },
          level: { type: ["integer", "null"] },
          rarity: { type: ["string", "null"] },
          boosts: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                stat: { type: ["string", "null"] },
                value_raw: { type: ["string", "null"] },
              },
              required: ["stat", "value_raw"],
            },
          },
          notes: { type: ["string", "null"] },
        },
        required: ["item_name", "stars", "level", "rarity", "boosts", "notes"],
      },
      notes: { type: ["string", "null"] },
    },
    required: ["weapon", "data_chip", "armor", "radar", "notes"],
  } as const;

  try {
    const resp = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "Extract hero gear values from a mobile game hero gear screenshot. " +
            "Return ONLY the JSON object matching the schema. " +
            "If a value is not visible, return null and explain briefly in notes.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "From this HERO GEAR screen, extract the four gear slots: Weapon, Data Chip, Armor, and Radar. " +
                "For each slot, extract item name, stars, level, rarity if visible, and every visible boost to the hero. " +
                "For boosts, return the stat name and raw value text exactly as shown.",
            },
            { type: "input_image", image_url: imageUrl, detail: "high" },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "hero_gear_extract",
          strict: true,
          schema,
        },
      },
      temperature: 0,
    });

    const raw = resp.output_text ?? "";
    if (!raw) {
      return NextResponse.json({ ok: false, error: "Model returned empty output" }, { status: 500 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: false, error: "Model did not return valid JSON", raw }, { status: 500 });
    }

    const pieces: Record<GearSlotKey, any> = {
      weapon: null,
      data_chip: null,
      armor: null,
      radar: null,
    };

    for (const slot of gearSlots) {
      const src = parsed?.[slot];
      const boosts = Array.isArray(src?.boosts) ? src.boosts : [];

      pieces[slot] = {
        slot,
        item_name: clampStr(src?.item_name, 120),
        stars: toIntOrNull(src?.stars),
        level: toIntOrNull(src?.level),
        rarity: clampStr(src?.rarity, 60),
        boosts: boosts.map((b: any) => ({
          stat: clampStr(b?.stat, 80),
          value_raw: clampStr(b?.value_raw, 80),
          value_numeric: parseBoostNumeric(clampStr(b?.value_raw, 80)),
        })),
        notes: clampStr(src?.notes, 300),
      };
    }

    const extracted = {
      kind: "hero_gear" as const,
      pieces,
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
