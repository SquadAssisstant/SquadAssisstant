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

function clampStr(v: any, max = 120): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function parseCompactNumber(raw: string | null): number | null {
  if (!raw) return null;
  const s0 = raw.trim().replace(/,/g, "");
  if (!s0) return null;

  // Common forms: "89.7K", "4.8M", "20000", "495"
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
  if (kind !== "hero_profile") {
    return NextResponse.json(
      { ok: false, error: `Unsupported kind "${kind}" for hero extract (expected "hero_profile")` },
      { status: 400 }
    );
  }

  const bucket = up.data.storage_bucket || "uploads";
  const path = String(up.data.storage_path || "");
  if (!path) return NextResponse.json({ ok: false, error: "Upload has no storage_path" }, { status: 500 });

  // Sign URL for model access
  const signed = await sb.storage.from(bucket).createSignedUrl(path, 60 * 10);
  if (signed.error) return NextResponse.json({ ok: false, error: signed.error.message }, { status: 500 });

  const imageUrl: string = signed.data?.signedUrl;
  if (!imageUrl) return NextResponse.json({ ok: false, error: "Could not sign image URL" }, { status: 500 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: "OPENAI_API_KEY missing" }, { status: 500 });

  const client = new OpenAI({ apiKey });

  // Strict schema: no more "invalid JSON"
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: ["string", "null"] },
      level: { type: ["integer", "null"] },
      stars: { type: ["integer", "null"] },

      // Gold number under the name = overall hero power
      power_raw: { type: ["string", "null"] },

      // Stats shown in the card
      attack_raw: { type: ["string", "null"] },
      hp_raw: { type: ["string", "null"] },
      defense_raw: { type: ["string", "null"] },
      march_size_raw: { type: ["string", "null"] },

      notes: { type: ["string", "null"] },
    },
    required: [
      "name",
      "level",
      "stars",
      "power_raw",
      "attack_raw",
      "hp_raw",
      "defense_raw",
      "march_size_raw",
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
            "Extract hero profile values from a mobile game hero card screenshot. " +
            "Return ONLY the JSON object matching the schema. " +
            "If a value is not visible, return null and explain briefly in notes.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "From this HERO PROFILE card, extract:\n" +
                "- hero name\n" +
                "- level (big white number above stats)\n" +
                "- stars if visible\n" +
                "- overall total power (gold number under name)\n" +
                "- stats: Attack, HP, Defense, March Size (as text exactly)\n" +
                "Return null if not visible.",
            },
            // IMPORTANT: image_url must be a string; detail is sibling
            { type: "input_image", image_url: imageUrl, detail: "high" },
          ],
        },
      ],
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
      return NextResponse.json({ ok: false, error: "Model returned empty output" }, { status: 500 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: false, error: "Model did not return valid JSON", raw }, { status: 500 });
    }

    const name = clampStr(parsed?.name);
    const level = toIntOrNull(parsed?.level);
    const stars = toIntOrNull(parsed?.stars);

    const power_raw = clampStr(parsed?.power_raw, 40);
    const attack_raw = clampStr(parsed?.attack_raw, 40);
    const hp_raw = clampStr(parsed?.hp_raw, 40);
    const defense_raw = clampStr(parsed?.defense_raw, 40);
    const march_size_raw = clampStr(parsed?.march_size_raw, 40);

    const extracted = {
      // These map directly to your existing modal fields:
      name,
      level: level ?? 0,
      stars: stars ?? 0,

      // Store gold number into the field your UI calls "power"
      power: parseCompactNumber(power_raw) ?? 0,

      // Stats: keep both numeric and raw so you can display nicely AND do math
      stats: {
        attack: parseCompactNumber(attack_raw) ?? 0,
        hp: parseCompactNumber(hp_raw) ?? 0,
        defense: parseCompactNumber(defense_raw) ?? 0,
        march_size: toIntOrNull(march_size_raw) ?? 0,

        attack_raw,
        hp_raw,
        defense_raw,
        march_size_raw,
        power_raw,
      },

      // Always include source upload id for details lookup without facts_id linking
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
