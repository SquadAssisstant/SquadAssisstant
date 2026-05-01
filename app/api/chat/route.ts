import OpenAI from "openai";
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildMainChatContext } from "@/lib/chat/contextBuilder";
import { isReb3lsTrigger, getReb3lsMessage } from "@/lib/chat/easterEgg";
import { buildMainChatSystemPrompt } from "@/lib/chat/systemPrompt";
import {
  redactSensitiveGameIdentifiers,
  saveKnowledgeEntries,
} from "@/lib/chat/knowledgeStore";

type PriorMessage = {
  role?: string;
  text?: string;
};

type ChatRequest = {
  message?: string;
  links?: string[];
  upload_ids?: number[];
  image_data_urls?: string[];
  save_learnings?: boolean;
  prior_messages?: PriorMessage[];
};

type UploadLookupRow = {
  id: number;
  url?: string | null;
  kind?: string | null;
};

type KnowledgeEntry = {
  category: string;
  subject_key: string;
  title: string;
  content: string;
  confidence: number;
  source_upload_ids?: number[];
  source_links?: string[];
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function maybeImageLink(url: string) {
  return /\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i.test(url);
}

function extractBattleAnalyzerPayload(message: string): any | null {
  const marker = "Battle Analyzer Handoff:";
  const idx = message.indexOf(marker);
  if (idx < 0) return null;

  const raw = message.slice(idx + marker.length).trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function compactNumber(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "Unknown";
  return Math.round(n).toLocaleString();
}

function buildBattleHandoffInstruction(payload: any) {
  const comparison = payload?.comparison ?? null;
  const factorBreakdown = payload?.factor_breakdown ?? null;
  const damageModel = payload?.damage_model ?? null;
  const missingData = Array.isArray(payload?.missing_data)
    ? payload.missing_data
    : [];
  const reasons = Array.isArray(payload?.reasons) ? payload.reasons : [];

  return [
    "The user transferred a Battle Analyzer result into Main Chat.",
    "",
    "Your job:",
    "- Explain the analyzer output in plain English.",
    "- Use the numbers already computed in the payload.",
    "- Do not invent new stats.",
    "- Do not pretend to re-run the analyzer.",
    "- If a value is missing, say it was not visible or not saved.",
    "- Enemy-side details may be estimates unless visible in the report.",
    "- Focus on game/battle explanation only, not website troubleshooting.",
    "",
    "Quick comparison:",
    `Outcome: ${comparison?.outcome ?? "unknown"}`,
    `Your power: ${compactNumber(comparison?.yours?.visible_power)}`,
    `Enemy power: ${compactNumber(comparison?.theirs?.visible_power)}`,
    `Your effective value: ${compactNumber(
      comparison?.yours?.final_effective_value
    )}`,
    `Enemy effective estimate: ${compactNumber(
      comparison?.theirs?.final_effective_value_estimate
    )}`,
    "",
    "Your advantages:",
    ...(comparison?.advantages?.length
      ? comparison.advantages.map((x: string) => `- ${x}`)
      : ["- None clearly detected."]),
    "",
    "Enemy advantages / your disadvantages:",
    ...(comparison?.disadvantages?.length
      ? comparison.disadvantages.map((x: string) => `- ${x}`)
      : ["- None clearly detected."]),
    "",
    "Reasons:",
    ...(reasons.length ? reasons.map((x: string) => `- ${x}`) : ["- None."]),
    "",
    "Missing or estimated data:",
    ...(missingData.length
      ? missingData.map((x: string) => `- ${x}`)
      : ["- No major missing-data notes were returned."]),
    "",
    "Full structured payload:",
    JSON.stringify(
      {
        summary: payload?.summary ?? "",
        analysis: payload?.analysis ?? "",
        context_summary: payload?.context_summary ?? "",
        comparison,
        factor_breakdown: factorBreakdown,
        damage_model: damageModel,
        reasons,
        missing_data: missingData,
      },
      null,
      2
    ),
  ].join("\n");
}

async function lookupUploadUrls(uploadIds: number[]) {
  if (!uploadIds.length) return [] as string[];

  const sb: any = supabaseAdmin();
  const { data } = await sb
    .from("uploads")
    .select("id, url, kind")
    .in("id", uploadIds);

  const rows: UploadLookupRow[] = Array.isArray(data) ? data : [];

  return rows
    .map((row) => String(row.url ?? "").trim())
    .filter(Boolean)
    .filter(maybeImageLink);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as ChatRequest;

    const message = String(body?.message ?? "").trim();

    const links = asArray(body?.links)
      .map((v) => String(v).trim())
      .filter(Boolean);

    const uploadIds = asArray(body?.upload_ids)
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v) && v > 0);

    const imageDataUrls = asArray(body?.image_data_urls)
      .map((v) => String(v).trim())
      .filter(Boolean)
      .slice(0, 4);

    const priorMessages = asArray<PriorMessage>(body?.prior_messages)
      .map((m) => ({
        role: String(m?.role ?? "user"),
        text: String(m?.text ?? "").trim(),
      }))
      .filter((m) => m.text)
      .slice(-8);

    if (!message && !links.length && !uploadIds.length && !imageDataUrls.length) {
      return NextResponse.json(
        { ok: false, error: "No question or material provided." },
        { status: 400 }
      );
    }

    if (isReb3lsTrigger(message)) {
      return NextResponse.json({
        ok: true,
        easter_egg: getReb3lsMessage(),
      });
    }

    const context = await buildMainChatContext(req);
    const uploadImageUrls = await lookupUploadUrls(uploadIds);
    const imageLinks = links.filter(maybeImageLink).slice(0, 4);

    const battlePayload = extractBattleAnalyzerPayload(message);
    const systemPrompt = [
      buildMainChatSystemPrompt(context.summary),
      "",
      "Main Chat role:",
      "- Help users understand game data, battle reports, optimizer results, heroes, squads, drones, overlord data, images, and linked game material.",
      "- Do not act as site tech support or troubleshooting help for the app itself.",
      "- If the user asks about app bugs, politely say that this chat is for game analysis and that app troubleshooting can be handled separately.",
      "- Keep answers practical and grounded in provided data.",
      "- Do not invent exact numbers that are not in provided data.",
      "- When Battle Analyzer Handoff data is present, explain that payload instead of re-running analysis.",
    ].join("\n");

    const priorText = priorMessages.length
      ? priorMessages.map((m) => `${m.role}: ${m.text}`).join("\n")
      : "None.";

    const userInstruction = battlePayload
      ? buildBattleHandoffInstruction(battlePayload)
      : [
          "User request:",
          message || "Analyze the provided material and explain what matters.",
          "",
          "Recent conversation:",
          priorText,
          "",
          links.length ? `Links supplied:\n${links.join("\n")}` : "No links supplied.",
          uploadIds.length
            ? `Saved upload IDs supplied:\n${uploadIds.join(", ")}`
            : "No saved upload IDs supplied.",
          "",
          "If images, screenshots, or image links are provided, inspect them visually and explain useful game information.",
          "If website links are provided, discuss only the text/link context available to you and be clear if the linked page itself was not fetched.",
        ].join("\n");

    const reusableTextPrompt = [
      userInstruction,
      "",
      "Return strict JSON only in this shape:",
      "{",
      '  "answer": string,',
      '  "knowledge_entries": [',
      "    {",
      '      "category": string,',
      '      "subject_key": string,',
      '      "title": string,',
      '      "content": string,',
      '      "confidence": number',
      "    }",
      "  ]",
      "}",
      "",
      "Knowledge saving rules:",
      "- Save only reusable game knowledge.",
      "- Do not save temporary battle handoff details as reusable knowledge unless they contain general game mechanics.",
      "- Never reveal, repeat, or save player names, alliance names, or server identifiers.",
      "- If material is uncertain or incomplete, say so.",
      "- Main Chat may advise what optimizer settings the user should choose, but must not pretend to have run optimizer or analyzer itself.",
    ].join("\n");

    const userContent: any[] = [{ type: "text", text: reusableTextPrompt }];

    for (const url of imageLinks) {
      userContent.push({
        type: "image_url",
        image_url: { url },
      });
    }

    for (const url of uploadImageUrls) {
      userContent.push({
        type: "image_url",
        image_url: { url },
      });
    }

    for (const dataUrl of imageDataUrls) {
      userContent.push({
        type: "image_url",
        image_url: { url: dataUrl },
      });
    }

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
      temperature: battlePayload ? 0.1 : 0.2,
      max_tokens: battlePayload ? 1400 : 1000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "system",
          content: `Compact app/game context:\n${JSON.stringify(
            {
              heroCount: context.heroCount,
              squadStateLoaded: context.squadStateLoaded,
              battleFileCount: context.battleFileCount,
              optimizerFileCount: context.optimizerFileCount,
              imageLinksProvided: imageLinks.length,
              savedUploadImagesResolved: uploadImageUrls.length,
              directUploadedImagesProvided: imageDataUrls.length,
              battleAnalyzerHandoffDetected: !!battlePayload,
            },
            null,
            2
          )}`,
        },
        {
          role: "user",
          content: userContent,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";

    let parsed: {
      answer?: string;
      knowledge_entries?: Array<{
        category?: string;
        subject_key?: string;
        title?: string;
        content?: string;
        confidence?: number;
      }>;
    } = {};

    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        answer: raw,
        knowledge_entries: [],
      };
    }

    const answer = redactSensitiveGameIdentifiers(
      String(parsed?.answer ?? "No answer returned.")
    );

    const knowledgeEntries: KnowledgeEntry[] = Array.isArray(parsed?.knowledge_entries)
      ? parsed.knowledge_entries
          .map((entry) => ({
            category:
              String(entry?.category ?? "general_observation").trim() ||
              "general_observation",
            subject_key: String(entry?.subject_key ?? "general").trim() || "general",
            title: String(entry?.title ?? "").trim(),
            content: String(entry?.content ?? "").trim(),
            confidence: Math.max(
              0,
              Math.min(1, Number(entry?.confidence ?? 0.5))
            ),
            source_upload_ids: uploadIds,
            source_links: links,
          }))
          .filter((entry) => entry.title && entry.content)
      : [];

    let savedSummary: string[] = [];

    if (body?.save_learnings !== false && knowledgeEntries.length) {
      await saveKnowledgeEntries(knowledgeEntries);
      savedSummary = knowledgeEntries.map(
        (entry) => `• ${entry.title} (${Math.round(entry.confidence * 100)}% confidence)`
      );
    }

    return NextResponse.json({
      ok: true,
      answer,
      knowledge_saved_summary: savedSummary,
      battle_handoff_detected: !!battlePayload,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Main chat failed" },
      { status: 500 }
    );
  }
            }
