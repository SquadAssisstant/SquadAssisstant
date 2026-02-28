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

function clampStr(s: any, max = 120): string | null {
  const t = String(s ?? "").trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const sess = await requireSessionFromReq(req);
  if (!sess) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { upload_id?: unknown } | null;
  const uploadId = typeof body?.upload_id === "number" ? body.upload_id : Number(body?.upload_id);

  if (!Number.isFinite(uploadId)) {
    return NextResponse.json({ ok: false, error: "Missing/invalid upload_id" }, { status: 400 });
  }

  const sb: any = supabaseAdmin();

  // Get upload row + ensure ownership
  const up = await sb
    .from("player_uploads")
    .select("id, profile_id, storage_bucket, storage_path")
    .eq("id", uploadId)
    .eq("profile_id", sess.profileId)
    .maybeSingle();

  if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });
  if (!up.data) return NextResponse.json({ ok: false, error: "Upload not found" }, { status: 404 });

  const bucket = up.data.storage_bucket || "uploads";
  const path = up.data.storage_path;

  if (!path) {
    return NextResponse.json({ ok: false, error: "Upload has no storage_path" }, { status: 500 });
  }

  // Create a signed URL so the model can fetch the image
  const signed = await sb.storage.from(bucket).createSignedUrl(path, 60 * 10);
  if (signed.error) return NextResponse.json({ ok: false, error: signed.error.message }, { status: 500 });

  const imageUrl: string = signed.data?.signedUrl;
  if (!imageUrl) return NextResponse.json({ ok: false, error: "Could not sign image URL" }, { status: 500 });

  // Structured Outputs schema for hero card extraction
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: ["string", "null"] },
      power_total: { type: ["integer", "null"] },
      level: { type: ["integer", "null"] },
      stars: { type: ["integer", "null"] },

      stats: {
        type: "object",
        additionalProperties: false,
        properties: {
          attack: { type: ["number", "null"] },
          hp: { type: ["number", "null"] },
          defense: { type: ["number", "null"] },
          march_size: { type: ["integer", "null"] },

          // optional raw strings if the UI wants to display "89.7K" / "4.8M"
          attack_raw: { type: ["string", "null"] },
          hp_raw: { type: ["string", "null"] },
          defense_raw: { type: ["string", "null"] },
          march_size_raw: { type: ["string", "null"] },
        },
        required: ["attack", "hp", "defense", "march_size", "attack_raw", "hp_raw", "defense_raw", "march_size_raw"],
      },

      gear: {
        type: ["object", "null"],
        additionalProperties: false,
        properties: {
          power: { type: ["integer", "null"] },
          buffs: { type: "array", items: { type: "string" } },
          debuffs: { type: "array", items: { type: "string" } },
        },
        required: ["power", "buffs", "debuffs"],
      },

      skills: {
        type: ["object", "null"],
        additionalProperties: false,
        properties: {
          power: { type: ["integer", "null"] },
          buffs: { type: "array", items: { type: "string" } },
          debuffs: { type: "array", items: { type: "string" } },
        },
        required: ["power", "buffs", "debuffs"],
      },

      notes: { type: ["string", "null"] },
    },
    required: ["name", "power_total", "level", "stars", "stats", "gear", "skills", "notes"],
  } as const;

  try {
    const resp = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "You extract structured hero stats from a mobile game hero card screenshot. " +
            "Return ONLY the JSON object that matches the provided schema. " +
            "If a field is not visible, return null (or empty arrays) and explain briefly in notes.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Extract from the hero card screenshot:\n" +
                "- name\n" +
                "- the gold number under the name (overall total power)\n" +
                "- the big white level number above the stats\n" +
                "- stats: Attack, HP, Defense, March Size (give both numeric + raw text like 89.7K / 4.8M)\n" +
                "- if visible anywhere in the screenshot: gear power + gear buffs/debuffs; skill power + buffs/debuffs\n" +
                "Return null for anything not visible.",
            },
            // IMPORTANT: Responses API expects image_url to be a string, with detail as a sibling field. :contentReference[oaicite:2]{index=2}
            {
              type: "input_image",
              image_url: imageUrl,
              detail: "high",
            },
          ],
        },
      ],
      // IMPORTANT: Force strict JSON Schema output to eliminate "invalid JSON" failures. :contentReference[oaicite:3]{index=3}
      text: {
        format: {
          type: "json_schema",
          name: "hero_profile_extract",
          strict: true,
          schema,
        },
      },
      temperature: 0,
    });

    const raw = resp.output_text ?? "";
    if (!raw) {
      return NextResponse.json(
        { ok: false, error: "Model returned empty output", debug: { has_output_text: false } },
        { status: 500 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Model did not return valid JSON", debug: { raw } },
        { status: 500 }
      );
    }

    // Normalize + sanitize a bit for your UI
    const out = {
      name: clampStr(parsed?.name),
      power_total: toIntOrNull(parsed?.power_total),
      level: toIntOrNull(parsed?.level),
      stars: toIntOrNull(parsed?.stars),

      stats: {
        attack: typeof parsed?.stats?.attack === "number" ? parsed.stats.attack : null,
        hp: typeof parsed?.stats?.hp === "number" ? parsed.stats.hp : null,
        defense: typeof parsed?.stats?.defense === "number" ? parsed.stats.defense : null,
        march_size: toIntOrNull(parsed?.stats?.march_size),

        attack_raw: clampStr(parsed?.stats?.attack_raw, 40),
        hp_raw: clampStr(parsed?.stats?.hp_raw, 40),
        defense_raw: clampStr(parsed?.stats?.defense_raw, 40),
        march_size_raw: clampStr(parsed?.stats?.march_size_raw, 40),
      },

      gear: parsed?.gear
        ? {
            power: toIntOrNull(parsed.gear.power),
            buffs: Array.isArray(parsed.gear.buffs) ? parsed.gear.buffs.map((x: any) => String(x)).slice(0, 50) : [],
            debuffs: Array.isArray(parsed.gear.debuffs) ? parsed.gear.debuffs.map((x: any) => String(x)).slice(0, 50) : [],
          }
        : null,

      skills: parsed?.skills
        ? {
            power: toIntOrNull(parsed.skills.power),
            buffs: Array.isArray(parsed.skills.buffs) ? parsed.skills.buffs.map((x: any) => String(x)).slice(0, 50) : [],
            debuffs: Array.isArray(parsed.skills.debuffs) ? parsed.skills.debuffs.map((x: any) => String(x)).slice(0, 50) : [],
          }
        : null,

      notes: clampStr(parsed?.notes, 500),
    };

    return NextResponse.json({ ok: true, extracted: out });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Extract failed", debug: { name: e?.name, code: e?.code } },
      { status: 500 }
    );
  }
}
