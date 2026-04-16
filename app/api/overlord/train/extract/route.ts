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

type BranchType = "attack" | "defense" | "hp";

function emptyBranch(type: BranchType) {
  return {
    type,
    name: null as string | null,
    level: null as number | null,
    hero_bonus: {
      stat: null as string | null,
      current: null as number | null,
      next: null as number | null,
    },
    overlord_bonus: {
      stat: null as string | null,
      current: null as number | null,
      next: null as number | null,
    },
    requirements: [
      { item_index: 1, current: null as number | null, required: null as number | null },
      { item_index: 2, current: null as number | null, required: null as number | null },
    ],
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
  if (!isOverlordKind(up.data.kind)) {
    return NextResponse.json(
      { ok: false, error: `Unsupported kind "${String(up.data.kind)}" for overlord train extract` },
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
      bond_title: { type: ["string", "null"] },
      power_raw: { type: ["string", "null"] },
      selected_branch: { type: ["string", "null"], enum: ["attack", "defense", "hp", null] },

      attack_name: { type: ["string", "null"] },
      attack_level: { type: ["integer", "null"] },
      defense_name: { type: ["string", "null"] },
      defense_level: { type: ["integer", "null"] },
      hp_name: { type: ["string", "null"] },
      hp_level: { type: ["integer", "null"] },

      selected_hero_stat: { type: ["string", "null"] },
      selected_hero_current: { type: ["integer", "null"] },
      selected_hero_next: { type: ["integer", "null"] },
      selected_overlord_stat: { type: ["string", "null"] },
      selected_overlord_current: { type: ["integer", "null"] },
      selected_overlord_next: { type: ["integer", "null"] },

      requirement_1_current: { type: ["integer", "null"] },
      requirement_1_required: { type: ["integer", "null"] },
      requirement_2_current: { type: ["integer", "null"] },
      requirement_2_required: { type: ["integer", "null"] },

      note: { type: ["string", "null"] },
      notes: { type: ["string", "null"] },
    },
    required: [
      "bond_title",
      "power_raw",
      "selected_branch",
      "attack_name",
      "attack_level",
      "defense_name",
      "defense_level",
      "hp_name",
      "hp_level",
      "selected_hero_stat",
      "selected_hero_current",
      "selected_hero_next",
      "selected_overlord_stat",
      "selected_overlord_current",
      "selected_overlord_next",
      "requirement_1_current",
      "requirement_1_required",
      "requirement_2_current",
      "requirement_2_required",
      "note",
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
            "Extract overlord training values from a mobile game training screen. " +
            "Return ONLY the JSON object matching the schema. " +
            "If a value is not visible, return null and explain briefly in notes.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "From this OVERLORD TRAIN screen, determine which training branch is selected (attack, defense, or hp). " +
                "Extract all three branch levels and names if visible. " +
                "For the selected branch, extract the hero bonus preview stat and current/next values, the overlord bonus preview stat and current/next values, " +
                "the two requirement counters, the current bond title, overall power if visible, and the note text shown near the bottom.",
            },
            { type: "input_image", image_url: imageUrl, detail: "high" },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "overlord_train_extract",
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

    const selectedBranch: BranchType | null =
      parsed?.selected_branch === "attack" || parsed?.selected_branch === "defense" || parsed?.selected_branch === "hp"
        ? parsed.selected_branch
        : null;

    const branches = {
      attack: emptyBranch("attack"),
      defense: emptyBranch("defense"),
      hp: emptyBranch("hp"),
    };

    branches.attack.name = clampStr(parsed?.attack_name, 120);
    branches.attack.level = toIntOrNull(parsed?.attack_level);

    branches.defense.name = clampStr(parsed?.defense_name, 120);
    branches.defense.level = toIntOrNull(parsed?.defense_level);

    branches.hp.name = clampStr(parsed?.hp_name, 120);
    branches.hp.level = toIntOrNull(parsed?.hp_level);

    if (selectedBranch) {
      branches[selectedBranch].hero_bonus = {
        stat: clampStr(parsed?.selected_hero_stat, 80),
        current: toIntOrNull(parsed?.selected_hero_current),
        next: toIntOrNull(parsed?.selected_hero_next),
      };
      branches[selectedBranch].overlord_bonus = {
        stat: clampStr(parsed?.selected_overlord_stat, 80),
        current: toIntOrNull(parsed?.selected_overlord_current),
        next: toIntOrNull(parsed?.selected_overlord_next),
      };
      branches[selectedBranch].requirements = [
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
      ];
    }

    const extracted = {
      kind: "overlord_train" as const,
      bond_title: clampStr(parsed?.bond_title, 120),
      power: parseCompactNumber(clampStr(parsed?.power_raw, 40)),
      selected_branch: selectedBranch,
      branches,
      note: clampStr(parsed?.note, 300),
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
