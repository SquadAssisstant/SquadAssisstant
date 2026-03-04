// app/api/drone/extract/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

type Body = {
  upload_id: number;
  mode: "components" | "chips";
  // optional: if you want later to pass troop_type selection hints
  hint?: any;
};

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is missing`);
  return v;
}

function asNumberLoose(s: string): number | null {
  const n = Number(String(s).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { upload_id, mode } = body;
  if (!upload_id) return NextResponse.json({ error: "upload_id is required" }, { status: 400 });
  if (mode !== "components" && mode !== "chips") {
    return NextResponse.json({ error: "mode must be components or chips" }, { status: 400 });
  }

  // 1) Ask your backend for the public image URL for this upload
  const detailsRes = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/drone/details?upload_id=${encodeURIComponent(upload_id)}`,
    { method: "GET" }
  );

  const detailsJson = await detailsRes.json().catch(() => null);
  if (!detailsRes.ok) {
    return NextResponse.json(
      { error: detailsJson?.error ?? `Failed to fetch drone details (HTTP ${detailsRes.status})` },
      { status: 500 }
    );
  }

  const imageUrl = detailsJson?.image_url as string | undefined;
  if (!imageUrl) {
    return NextResponse.json({ error: "No image_url found for upload" }, { status: 404 });
  }

  const client = new OpenAI({ apiKey: mustEnv("OPENAI_API_KEY") });

  // 2) Vision extraction prompt — tuned to your UI screenshots
  const prompt =
    mode === "components"
      ? `You are extracting data from a mobile game screenshot showing "Drone Components".
Return STRICT JSON only.
Goal: Extract component tiles values: percent and level.
Output schema:
{
  "kind": "drone_components_extracted",
  "components": [
    {"label": string, "percent": number|null, "level": number|null}
  ]
}
Rules:
- components should be in the order shown on screen (top-left to bottom-right).
- percent is the percent value shown like "63%".
- level is the number shown like "Lv.8" -> 8.
- If a value is not visible, set it to null.
Return JSON only.`
      : `You are extracting data from a mobile game screenshot showing Drone Skill Chips / Chip Set.
Return STRICT JSON only.
Goal: Extract troop type label if visible (Tank/Air/Missile) and the 4 chip skill names and squad power if visible.
Output schema:
{
  "kind": "drone_chipset_extracted",
  "troop_type": "tank"|"air"|"missile"|null,
  "displayed_squad_power": string|null,
  "skills": {
    "initial_move": {"name": string|null, "chip_power": number|null} | null,
    "offensive": {"name": string|null, "chip_power": number|null} | null,
    "defense": {"name": string|null, "chip_power": number|null} | null,
    "interference": {"name": string|null, "chip_power": number|null} | null
  }
}
Rules:
- If chip power isn't visible in this screenshot, set chip_power to null.
- If a name isn't readable, set name to null.
Return JSON only.`;

  // Using Responses API (works with image_url as a string)
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
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // If model returned extra text, try to salvage JSON
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(text.slice(start, end + 1));
      } catch {}
    }
  }

  if (!parsed) {
    return NextResponse.json(
      { error: "Extraction failed: model did not return valid JSON", raw: text.slice(0, 500) },
      { status: 500 }
    );
  }

  // light normalization
  if (mode === "components" && Array.isArray(parsed.components)) {
    parsed.components = parsed.components.map((c: any) => ({
      label: typeof c?.label === "string" ? c.label : "",
      percent: c?.percent == null ? null : asNumberLoose(String(c.percent)),
      level: c?.level == null ? null : asNumberLoose(String(c.level)),
    }));
  }

  return NextResponse.json({ ok: true, upload_id, image_url: imageUrl, extracted: parsed });
}
