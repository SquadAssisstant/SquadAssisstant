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

function isDroneKind(kind: unknown) {
  const k = String(kind ?? "").trim().toLowerCase();
  return [
    "drone",
    "drone_profile",
    "drone_components",
    "drone_chipset",
    "drone_skill_chips",
    "drone_combat_boost",
    "drone_boost_chips",
  ].includes(k);
}

function clampStr(v: any, max = 120): string | null {
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

type TroopType = "tank" | "air" | "missile";
type SkillKey = "initial_move" | "offensive" | "defense" | "interference";

type SkillValue = {
  troop_type: TroopType;
  skill_type: SkillKey;
  name: string | null;
  chip_power: number | null;
  description: string | null;
};

type ChipSet = {
  troop_type: TroopType;
  label: string;
  assigned_squad_slot: number | null;
  displayed_squad_power: string | null;
  skills: Record<SkillKey, SkillValue>;
};

type BoostChipsValue = {
  kind: "drone_boost_chips";
  chip_sets: Record<TroopType, ChipSet>;
  combat_boost: {
    notes: string | null;
    raw: Record<string, string | null>;
  };
  source_upload_id: number;
};

const troopTypes: TroopType[] = ["tank", "air", "missile"];
const skillKeys: SkillKey[] = ["initial_move", "offensive", "defense", "interference"];

function blankSkill(troopType: TroopType, skillType: SkillKey): SkillValue {
  return {
    troop_type: troopType,
    skill_type: skillType,
    name: null,
    chip_power: null,
    description: null,
  };
}

function blankSet(troopType: TroopType): ChipSet {
  return {
    troop_type: troopType,
    label: troopType === "tank" ? "Tank Chip Set" : troopType === "air" ? "Air Chip Set" : "Missile Chip Set",
    assigned_squad_slot: null,
    displayed_squad_power: null,
    skills: {
      initial_move: blankSkill(troopType, "initial_move"),
      offensive: blankSkill(troopType, "offensive"),
      defense: blankSkill(troopType, "defense"),
      interference: blankSkill(troopType, "interference"),
    },
  };
}

function emptyBoostChipsValue(uploadId: number): BoostChipsValue {
  return {
    kind: "drone_boost_chips",
    chip_sets: {
      tank: blankSet("tank"),
      air: blankSet("air"),
      missile: blankSet("missile"),
    },
    combat_boost: {
      notes: null,
      raw: {},
    },
    source_upload_id: uploadId,
  };
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
  if (!isDroneKind(up.data.kind)) {
    return NextResponse.json(
      { ok: false, error: `Unsupported kind "${String(up.data.kind)}" for drone boost/chips extract` },
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
      troop_type: { type: ["string", "null"], enum: ["tank", "air", "missile", null] },
      displayed_squad_power: { type: ["string", "null"] },
      skills: {
        type: "object",
        additionalProperties: false,
        properties: {
          initial_move: {
            type: ["object", "null"],
            additionalProperties: false,
            properties: {
              name: { type: ["string", "null"] },
              chip_power: { type: ["integer", "null"] },
            },
            required: ["name", "chip_power"],
          },
          offensive: {
            type: ["object", "null"],
            additionalProperties: false,
            properties: {
              name: { type: ["string", "null"] },
              chip_power: { type: ["integer", "null"] },
            },
            required: ["name", "chip_power"],
          },
          defense: {
            type: ["object", "null"],
            additionalProperties: false,
            properties: {
              name: { type: ["string", "null"] },
              chip_power: { type: ["integer", "null"] },
            },
            required: ["name", "chip_power"],
          },
          interference: {
            type: ["object", "null"],
            additionalProperties: false,
            properties: {
              name: { type: ["string", "null"] },
              chip_power: { type: ["integer", "null"] },
            },
            required: ["name", "chip_power"],
          },
        },
        required: ["initial_move", "offensive", "defense", "interference"],
      },
      combat_boost_notes: { type: ["string", "null"] },
      notes: { type: ["string", "null"] },
    },
    required: ["troop_type", "displayed_squad_power", "skills", "combat_boost_notes", "notes"],
  } as const;

  try {
    const resp = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "Extract drone combat boost / skill chip values from a mobile game screenshot. " +
            "Return ONLY the JSON object matching the schema. " +
            "If a value is not visible, return null and explain briefly in notes.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "From this DRONE COMBAT BOOST / SKILL CHIPS screen, determine the troop type if visible " +
                "(tank, air, or missile), the displayed squad power if visible, and the 4 chip slots: " +
                "Initial Move, Offensive, Defense, Interference. For each skill, return chip name and chip power. " +
                "If combat boost text or summary is visible but not structured, put a short summary in combat_boost_notes.",
            },
            { type: "input_image", image_url: imageUrl, detail: "high" },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "drone_boost_chips_extract",
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

    const targetTroop: TroopType =
      parsed?.troop_type === "tank" || parsed?.troop_type === "air" || parsed?.troop_type === "missile"
        ? parsed.troop_type
        : "tank";

    const base = emptyBoostChipsValue(uploadId);

    for (const skillKey of skillKeys) {
      const source = parsed?.skills?.[skillKey];

      const nextSkill: SkillValue = {
        troop_type: targetTroop,
        skill_type: skillKey,
        name: clampStr(source?.name, 120),
        chip_power: toIntOrNull(source?.chip_power),
        description: null,
      };

      (base.chip_sets[targetTroop].skills as Record<SkillKey, SkillValue>)[skillKey] = nextSkill;
    }

    base.chip_sets[targetTroop].displayed_squad_power = clampStr(parsed?.displayed_squad_power, 40);
    base.combat_boost.notes = clampStr(parsed?.combat_boost_notes ?? parsed?.notes, 500);

    return NextResponse.json({
      ok: true,
      extracted: base,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Extract failed", debug: { name: e?.name, code: e?.code } },
      { status: 500 }
    );
  }
}
