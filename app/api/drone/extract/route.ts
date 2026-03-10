// app/api/drone/extract/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";

export const runtime = "nodejs";

type Body = {
  upload_id: number;
  mode: "components" | "chips";
  hint?: any;
};

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is missing`);
  return v;
}

function getCookieFromHeader(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) {
      return decodeURIComponent(p.slice(name.length + 1));
    }
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

function asNumberLoose(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {}

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {}
  }

  return null;
}

async function getSignedImageUrlForUpload(req: Request, uploadId: number) {
  const sess = await requireSessionFromReq(req);
  if (!sess) {
    return {
      ok: false as const,
      status: 401,
      error: "Unauthorized",
      image_url: null,
    };
  }

  const sb: any = supabaseAdmin();

  const up = await sb
    .from("player_uploads")
    .select("id, kind, storage_bucket, storage_path, profile_id")
    .eq("id", uploadId)
    .eq("profile_id", sess.profileId)
    .maybeSingle();

  if (up.error) {
    return {
      ok: false as const,
      status: 500,
      error: up.error.message || "Failed to load upload",
      image_url: null,
    };
  }

  if (!up.data) {
    return {
      ok: false as const,
      status: 404,
      error: "Upload not found",
      image_url: null,
    };
  }

  const bucket = up.data.storage_bucket || "uploads";
  const path = String(up.data.storage_path || "");

  if (!path) {
    return {
      ok: false as const,
      status: 404,
      error: "Upload has no storage path",
      image_url: null,
    };
  }

  const signed = await sb.storage.from(bucket).createSignedUrl(path, 60 * 60);

  if (signed.error || !signed.data?.signedUrl) {
    return {
      ok: false as const,
      status: 500,
      error: signed.error?.message || "Failed to create signed URL",
      image_url: null,
    };
  }

  return {
    ok: true as const,
    status: 200,
    error: null,
    image_url: signed.data.signedUrl,
    upload: up.data,
  };
}

export async function POST(req: Request) {
  try {
    let body: Body;

    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { upload_id, mode } = body;

    if (!upload_id) {
      return NextResponse.json({ error: "upload_id is required" }, { status: 400 });
    }

    if (!Number.isFinite(Number(upload_id))) {
      return NextResponse.json({ error: "upload_id must be a number" }, { status: 400 });
    }

    if (mode !== "components" && mode !== "chips") {
      return NextResponse.json(
        { error: "mode must be components or chips" },
        { status: 400 }
      );
    }

    const signedLookup = await getSignedImageUrlForUpload(req, Number(upload_id));

    if (!signedLookup.ok || !signedLookup.image_url) {
      return NextResponse.json(
        {
          error: signedLookup.error || "Failed to get image URL",
        },
        { status: signedLookup.status || 500 }
      );
    }

    const imageUrl = signedLookup.image_url;

    const client = new OpenAI({
      apiKey: mustEnv("OPENAI_API_KEY"),
    });

    const prompt =
      mode === "components"
        ? `You are extracting data from a mobile game screenshot showing drone components.
Return STRICT JSON only.

Output schema:
{
  "kind": "drone_components_extracted",
  "components": [
    { "label": string, "percent": number | null, "level": number | null }
  ]
}

Rules:
- Return exactly 6 components whenever possible.
- Keep them in the visible on-screen order from top-left to bottom-right.
- "percent" is the progress percent shown like 63%.
- "level" is the value shown like Lv.8 -> 8.
- If a label is unclear, provide the best short label you can.
- If a value is unreadable, return null.
- Return JSON only.`
        : `You are extracting data from a mobile game screenshot showing drone skill chips / chip set.
Return STRICT JSON only.

Output schema:
{
  "kind": "drone_chipset_extracted",
  "troop_type": "tank" | "air" | "missile" | null,
  "displayed_squad_power": string | null,
  "skills": {
    "initial_move": { "name": string | null, "chip_power": number | null } | null,
    "offensive": { "name": string | null, "chip_power": number | null } | null,
    "defense": { "name": string | null, "chip_power": number | null } | null,
    "interference": { "name": string | null, "chip_power": number | null } | null
  }
}

Rules:
- If chip power is not visible, return null.
- If chip name is unreadable, return null.
- Map the visible four slots to:
  initial_move, offensive, defense, interference.
- Return JSON only.`;

    const resp = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: imageUrl, detail: "high" },
          ],
        },
      ],
    });

    const text = resp.output_text?.trim() || "";
    const parsed = extractJsonObject(text);

    if (!parsed) {
      return NextResponse.json(
        {
          error: "Extraction failed: model did not return valid JSON",
          raw: text.slice(0, 1000),
          image_url: imageUrl,
        },
        { status: 500 }
      );
    }

    if (mode === "components") {
      const inputComponents = Array.isArray((parsed as any).components)
        ? (parsed as any).components
        : [];

      (parsed as any).kind = "drone_components_extracted";
      (parsed as any).components = inputComponents.map((c: any) => ({
        label: typeof c?.label === "string" ? c.label : "",
        percent: c?.percent == null ? null : asNumberLoose(c.percent),
        level: c?.level == null ? null : asNumberLoose(c.level),
      }));
    }

    if (mode === "chips") {
      const skills = (parsed as any)?.skills ?? {};

      (parsed as any).kind = "drone_chipset_extracted";
      (parsed as any).troop_type =
        (parsed as any)?.troop_type === "tank" ||
        (parsed as any)?.troop_type === "air" ||
        (parsed as any)?.troop_type === "missile"
          ? (parsed as any).troop_type
          : null;

      (parsed as any).displayed_squad_power =
        typeof (parsed as any)?.displayed_squad_power === "string"
          ? (parsed as any).displayed_squad_power
          : null;

      (parsed as any).skills = {
        initial_move: skills?.initial_move
          ? {
              name:
                typeof skills.initial_move?.name === "string"
                  ? skills.initial_move.name
                  : null,
              chip_power: asNumberLoose(skills.initial_move?.chip_power),
            }
          : null,
        offensive: skills?.offensive
          ? {
              name:
                typeof skills.offensive?.name === "string"
                  ? skills.offensive.name
                  : null,
              chip_power: asNumberLoose(skills.offensive?.chip_power),
            }
          : null,
        defense: skills?.defense
          ? {
              name:
                typeof skills.defense?.name === "string"
                  ? skills.defense.name
                  : null,
              chip_power: asNumberLoose(skills.defense?.chip_power),
            }
          : null,
        interference: skills?.interference
          ? {
              name:
                typeof skills.interference?.name === "string"
                  ? skills.interference.name
                  : null,
              chip_power: asNumberLoose(skills.interference?.chip_power),
            }
          : null,
      };
    }

    return NextResponse.json({
      ok: true,
      upload_id,
      image_url: imageUrl,
      extracted: parsed,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message ?? "Unexpected server error during drone extraction",
      },
      { status: 500 }
    );
  }
       }
