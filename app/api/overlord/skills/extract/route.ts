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

function clampStr(v: any, max = 1200): string | null {
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

function parseSeconds(raw: string | null): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d+(\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
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
      { ok: false, error: `Unsupported kind "${String(up.data.kind)}" for overlord skills extract` },
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
      selected_slot: { type: ["integer", "null"] },
      skills: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            slot: { type: ["integer", "null"] },
            name: { type: ["string", "null"] },
            level: { type: ["integer", "null"] },
            max_level: { type: ["integer", "null"] },
            type: { type: ["string", "null"] },
            category: { type: ["string", "null"] },
            cooldown_raw: { type: ["string", "null"] },
            description: { type: ["string", "null"] },
            scaling_detail: { type: ["string", "null"] },
            bonuses: {
              type: "array",
              items: { type: "string" },
            },
            locked_bonuses: {
              type: "array",
              items: { type: "string" },
            },
            upgrade_current: { type: ["integer", "null"] },
            upgrade_required: { type: ["integer", "null"] },
            stars: { type: ["integer", "null"] },
          },
          required: [
            "slot",
            "name",
            "level",
            "max_level",
            "type",
            "category",
            "cooldown_raw",
            "description",
            "scaling_detail",
            "bonuses",
            "locked_bonuses",
            "upgrade_current",
            "upgrade_required",
            "stars",
          ],
        },
      },
      notes: { type: ["string", "null"] },
    },
    required: ["selected_slot", "skills", "notes"],
  } as const;

  try {
    const resp = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "Extract overlord skills from a mobile game skill screen. " +
            "Return ONLY the JSON object matching the schema. " +
            "If a value is not visible, return null and explain briefly in notes.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "From this OVERLORD SKILL screen, identify the selected skill and the visible preview strip. " +
                "Extract all visible preview slots with slot order, level, stars, and name if visible. " +
                "For the selected skill, extract name, level, max level, type, category, cooldown if shown, full description text, " +
                "scaling detail, active bonus bullet lines, locked future bonus lines, and upgrade progress if shown. " +
                "If the screen says Max Level Reached, return null for upgrade_current and upgrade_required.",
            },
            { type: "input_image", image_url: imageUrl, detail: "high" },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "overlord_skills_extract",
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

    const rawSkills = Array.isArray(parsed?.skills) ? parsed.skills : [];
    const skills = rawSkills.slice(0, 5).map((skill: any, idx: number) => {
      const current = toIntOrNull(skill?.upgrade_current);
      const required = toIntOrNull(skill?.upgrade_required);

      return {
        slot: toIntOrNull(skill?.slot) ?? idx + 1,
        name: clampStr(skill?.name, 120),
        level: toIntOrNull(skill?.level),
        max_level: toIntOrNull(skill?.max_level),
        type: clampStr(skill?.type, 80),
        category: clampStr(skill?.category, 120),
        cooldown: parseSeconds(clampStr(skill?.cooldown_raw, 40)),
        description: clampStr(skill?.description, 1200),
        scaling_detail: clampStr(skill?.scaling_detail, 1200),
        bonuses: Array.isArray(skill?.bonuses)
          ? skill.bonuses.map((b: any) => String(b ?? "").trim()).filter(Boolean)
          : [],
        locked_bonuses: Array.isArray(skill?.locked_bonuses)
          ? skill.locked_bonuses.map((b: any) => String(b ?? "").trim()).filter(Boolean)
          : [],
        upgrade_progress:
          current === null && required === null
            ? null
            : {
                current,
                required,
              },
        stars: toIntOrNull(skill?.stars),
      };
    });

    const extracted = {
      kind: "overlord_skills" as const,
      selected_slot: toIntOrNull(parsed?.selected_slot),
      skills,
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
