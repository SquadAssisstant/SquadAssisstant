import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(raw.slice(first, last + 1));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function dataUrlFromBuffer(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export async function extractBattleReportPage({
  imageBuffer,
  mimeType,
  pageIndex,
}: {
  imageBuffer: Buffer;
  mimeType: string;
  pageIndex: number;
}) {
  const imageUrl = dataUrlFromBuffer(imageBuffer, mimeType);

  const completion = await client.chat.completions.create({
    model:
      process.env.OPENAI_VISION_MODEL ||
      process.env.OPENAI_CHAT_MODEL ||
      "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You extract structured data from Last War battle report screenshots. Return strict JSON only. Do not guess values that are not visible. Use null for unknown. Preserve left/right side exactly as shown.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `
Extract all visible battle report data from this screenshot.

Important:
- Blue/left side is not always the current user.
- Red/right side is not always the enemy.
- Use the labels shown: Attack Victory, Defense Failed, etc.
- Identify left side and right side separately.
- Extract powers using numbers like 34.3M as 34300000.
- Extract K values like 883.6K as 883600.
- Extract percentages as numbers, for example 57.3% -> 57.3.
- Extract hero names, levels, stars, troop icons/types if visible.
- Extract gear levels and skill levels if visible.
- Extract army category powers if visible: Drone, Tech, Decoration, Units, Wall of Honor, Overlord, Tactics Cards, Cosmetics, Other.
- Extract combat details percentages if visible.
- Do not infer hidden stats.

Return JSON in this shape:

{
  "page_index": ${pageIndex},
  "battle_report_id_text": null,
  "battle_time": null,
  "location": null,
  "left": {
    "side": "left",
    "role": null,
    "result_text": null,
    "player_name": null,
    "alliance": null,
    "server": null,
    "coordinates": null,
    "loss_or_score": null,
    "overview_power": null,
    "hero_power": null,
    "lineup_power": null,
    "army_power": null,
    "drone_power": null,
    "tech_power": null,
    "decoration_power": null,
    "units_power": null,
    "wall_of_honor_power": null,
    "overlord_power": null,
    "tactics_cards_power": null,
    "cosmetics_power": null,
    "other_power": null,
    "lineup_same_type_count": null,
    "lineup_bonus_pct": null,
    "lineup_note": null,
    "heroes": [],
    "gear": [],
    "skills": [],
    "combat_details": {}
  },
  "right": {
    "side": "right",
    "role": null,
    "result_text": null,
    "player_name": null,
    "alliance": null,
    "server": null,
    "coordinates": null,
    "loss_or_score": null,
    "overview_power": null,
    "hero_power": null,
    "lineup_power": null,
    "army_power": null,
    "drone_power": null,
    "tech_power": null,
    "decoration_power": null,
    "units_power": null,
    "wall_of_honor_power": null,
    "overlord_power": null,
    "tactics_cards_power": null,
    "cosmetics_power": null,
    "other_power": null,
    "lineup_same_type_count": null,
    "lineup_bonus_pct": null,
    "lineup_note": null,
    "heroes": [],
    "gear": [],
    "skills": [],
    "combat_details": {}
  },
  "visible_sections": [],
  "raw_visible_text": []
}
            `.trim(),
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
            },
          },
        ],
      },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content ?? "{}";

  return (
    safeJsonParse(raw) ?? {
      page_index: pageIndex,
      extraction_error: "Could not parse extraction JSON",
      raw,
    }
  );
}

function mergeSide(base: any, incoming: any) {
  const next = { ...(base ?? {}) };

  for (const [key, value] of Object.entries(incoming ?? {})) {
    if (value == null) continue;

    if (Array.isArray(value)) {
      if (value.length) {
        next[key] = [...(Array.isArray(next[key]) ? next[key] : []), ...value];
      }
      continue;
    }

    if (typeof value === "object") {
      next[key] = {
        ...(typeof next[key] === "object" && !Array.isArray(next[key])
          ? next[key]
          : {}),
        ...value,
      };
      continue;
    }

    if (next[key] == null || next[key] === "") {
      next[key] = value;
    }
  }

  return next;
}

export async function mergeBattleReportPageIntoParsed({
  supabase,
  profileId,
  reportId,
  pageId,
  pageIndex,
  extractedPage,
}: {
  supabase: any;
  profileId: string;
  reportId: string;
  pageId: string;
  pageIndex: number;
  extractedPage: any;
}) {
  const currentRes = await supabase
    .from("battle_reports")
    .select("parsed")
    .eq("id", reportId)
    .eq("profile_id", profileId)
    .single();

  if (currentRes.error) {
    throw new Error(currentRes.error.message);
  }

  const current = currentRes.data?.parsed ?? {};

  const pages = Array.isArray(current.pages_extracted)
    ? current.pages_extracted.filter(
        (p: any) => Number(p.page_index) !== Number(pageIndex)
      )
    : [];

  pages.push({
    page_id: pageId,
    page_index: pageIndex,
    extracted: extractedPage,
  });

  pages.sort((a: any, b: any) => Number(a.page_index) - Number(b.page_index));

  const nextParsed = {
    ...current,

    battle_report_id_text:
      current.battle_report_id_text ??
      extractedPage?.battle_report_id_text ??
      null,

    battle_time: current.battle_time ?? extractedPage?.battle_time ?? null,

    location: current.location ?? extractedPage?.location ?? null,

    left: mergeSide(current.left, extractedPage?.left),
    right: mergeSide(current.right, extractedPage?.right),

    visible_sections: Array.from(
      new Set([
        ...(Array.isArray(current.visible_sections)
          ? current.visible_sections
          : []),
        ...(Array.isArray(extractedPage?.visible_sections)
          ? extractedPage.visible_sections
          : []),
      ])
    ),

    raw_visible_text: [
      ...(Array.isArray(current.raw_visible_text) ? current.raw_visible_text : []),
      ...(Array.isArray(extractedPage?.raw_visible_text)
        ? extractedPage.raw_visible_text
        : []),
    ],

    pages_extracted: pages,
  };

  const updateRes = await supabase
    .from("battle_reports")
    .update({
      parsed: nextParsed,
    })
    .eq("id", reportId)
    .eq("profile_id", profileId);

  if (updateRes.error) {
    throw new Error(updateRes.error.message);
  }

  return nextParsed;
}
