// app/api/drone/extract/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

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

function asNumberLoose(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function getBaseUrl(req: Request) {
  const envBase = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (envBase) return envBase.replace(/\/+$/, "");
  return new URL(req.url).origin;
}

async function readJsonFromResponse(res: Response) {
  const text = await res.text();

  if (!text || !text.trim()) {
    return {
      ok: false,
      data: null as any,
      rawText: text,
      error: `Empty response body (${res.status} ${res.statusText})`,
    };
  }

  try {
    return {
      ok: true,
      data: JSON.parse(text),
      rawText: text,
      error: null,
    };
  } catch {
    return {
      ok: false,
      data: null as any,
      rawText: text,
      error: `Response was not valid JSON (${res.status} ${res.statusText})`,
    };
  }
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

    if (mode !== "components" && mode !== "chips") {
      return NextResponse.json(
        { error: "mode must be components or chips" },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl(req);
    const detailsUrl = `${baseUrl}/api/drone/details?upload_id=${encodeURIComponent(
      String(upload_id)
    )}`;

    let detailsRes: Response;
    try {
      detailsRes = await fetch(detailsUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          cookie: req.headers.get("cookie") ?? "",
        },
        cache: "no-store",
      });
    } catch (error: any) {
      return NextResponse.json(
        {
          error: "Failed to fetch drone details endpoint",
          details: error?.message ?? "Unknown fetch error",
          details_url: detailsUrl,
        },
        { status: 500 }
      );
    }

    const detailsParsed = await readJsonFromResponse(detailsRes);

    if (!detailsRes.ok) {
      return NextResponse.json(
        {
          error:
            detailsParsed.data?.error ??
            detailsParsed.error ??
            `Failed to fetch drone details (HTTP ${detailsRes.status})`,
          status: detailsRes.status,
          details_url: detailsUrl,
          raw:
            typeof detailsParsed.rawText === "string"
              ? detailsParsed.rawText.slice(0, 500)
              : "",
        },
        { status: 500 }
      );
    }

    if (!detailsParsed.data) {
      return NextResponse.json(
        {
          error: detailsParsed.error ?? "Drone details returned invalid JSON",
          details_url: detailsUrl,
          raw:
            typeof detailsParsed.rawText === "string"
              ? detailsParsed.rawText.slice(0, 500)
              : "",
        },
        { status: 500 }
      );
    }

    const imageUrl = detailsParsed.data?.image_url as string | undefined;

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json(
        {
          error: "No image_url found for upload",
          details_url: detailsUrl,
          details_response: detailsParsed.data,
        },
        { status: 404 }
      );
    }

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
- Keep them in on-screen order from top-left to bottom-right.
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
            { type: "input_image", image_url: imageUrl, detail: "low" },
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
