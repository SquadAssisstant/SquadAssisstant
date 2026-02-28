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

function clampStr(v: any, max = 200): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
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

  const kind = String(up.data.kind || "");
  if (kind !== "drone") {
    return NextResponse.json(
      { ok: false, error: `Upload kind must be "drone" (got "${kind}")` },
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
      section: {
        type: "string",
        enum: ["attributes", "components", "extra_attributes", "combat_boost", "skill_chip", "unknown"],
      },

      // Common (when visible)
      power_total: { type: ["integer", "null"] },
      level: { type: ["integer", "null"] },

      // Attributes screen
      critical_upgrade_stage: { type: ["string", "null"] }, // e.g. "1/5"
      attributes_panel: {
        type: ["object", "null"],
        additionalProperties: false,
        properties: {
          hp: {
            type: ["object", "null"],
            additionalProperties: false,
            properties: {
              from: { type: ["integer", "null"] },
              to: { type: ["integer", "null"] },
              pct: { type: ["number", "null"] },
            },
            required: ["from", "to", "pct"],
          },
          atk: {
            type: ["object", "null"],
            additionalProperties: false,
            properties: {
              from: { type: ["integer", "null"] },
              to: { type: ["integer", "null"] },
              pct: { type: ["number", "null"] },
            },
            required: ["from", "to", "pct"],
          },
          def: {
            type: ["object", "null"],
            additionalProperties: false,
            properties: {
              from: { type: ["integer", "null"] },
              to: { type: ["integer", "null"] },
              pct: { type: ["number", "null"] },
            },
            required: ["from", "to", "pct"],
          },
        },
        required: ["hp", "atk", "def"],
      },

      // Components screen
      components: {
        type: ["array", "null"],
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            progress_pct: { type: ["integer", "null"] }, // 63
            level: { type: ["integer", "null"] }, // 8
          },
          required: ["progress_pct", "level"],
        },
      },

      // Extra attributes list
      extra_attributes: {
        type: ["array", "null"],
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            value_raw: { type: "string" }, // "+873287" or "1.00%"
          },
          required: ["name", "value_raw"],
        },
      },

      // Combat boost screen
      combat_boost: {
        type: ["object", "null"],
        additionalProperties: false,
        properties: {
          stage: { type: ["string", "null"] }, // "III"
          level: { type: ["integer", "null"] }, // 368
          xp_cur: { type: ["integer", "null"] },
          xp_max: { type: ["integer", "null"] },
          breakthrough_level: { type: ["integer", "null"] }, // 450
          base_hp: { type: ["integer", "null"] }, // 589060
          base_atk: { type: ["integer", "null"] }, // 14025
          base_def: { type: ["integer", "null"] }, // 2805
          chip_skill_boost: { type: ["integer", "null"] }, // +2
        },
        required: [
          "stage",
          "level",
          "xp_cur",
          "xp_max",
          "breakthrough_level",
          "base_hp",
          "base_atk",
          "base_def",
          "chip_skill_boost",
        ],
      },

      // Skill chip screen
      skill_chip: {
        type: ["object", "null"],
        additionalProperties: false,
        properties: {
          set_name: { type: ["string", "null"] }, // "Tank Chip Set"
          squad_power_raw: { type: ["string", "null"] }, // "39.57M"
          preset_selected: { type: ["integer", "null"] }, // 1
        },
        required: ["set_name", "squad_power_raw", "preset_selected"],
      },

      notes: { type: ["string", "null"] },
    },
    required: [
      "section",
      "power_total",
      "level",
      "critical_upgrade_stage",
      "attributes_panel",
      "components",
      "extra_attributes",
      "combat_boost",
      "skill_chip",
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
            "You extract structured Drone data from a mobile game Tactical Drone screenshot. " +
            "First classify the screenshot into a section: attributes, components, extra_attributes, combat_boost, skill_chip, or unknown. " +
            "Then extract only the values visible on the screen. Return null for fields not visible. " +
            "Return ONLY the JSON object matching the provided schema.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Extract Tactical Drone data. This screenshot is one of:\n" +
                "- Attributes screen: power, level, critical upgrade stage, and the 3 rows (HP/ATK/DEF) with from→to and %.\n" +
                "- Components screen: 6 component tiles showing progress % and level.\n" +
                "- Extra Attributes list: capture each line name + value string (keep % or +flat).\n" +
                "- Combat Boost screen: drone hp/atk/def, chip skill boost, stage, level, xp cur/max, breakthrough level.\n" +
                "- Skill Chip screen: set name, squad power, preset selected.\n" +
                "Classify section correctly and extract only what is visible.",
            },
            { type: "input_image", image_url: imageUrl, detail: "high" },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "drone_extract",
          strict: true,
          schema,
        },
      },
      temperature: 0,
    });

    const raw = resp.output_text ?? "";
    if (!raw) return NextResponse.json({ ok: false, error: "Model returned empty output" }, { status: 500 });

    const parsed = JSON.parse(raw);

    // Add upload_id so save can link sources
    return NextResponse.json({
      ok: true,
      extracted: {
        ...parsed,
        notes: clampStr(parsed?.notes, 500),
        source_upload_id: uploadId,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Extract failed", debug: { name: e?.name, code: e?.code } },
      { status: 500 }
    );
  }
    }
