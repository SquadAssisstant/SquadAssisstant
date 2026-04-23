import OpenAI from "openai";
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildMainChatContext } from "@/lib/chat/contextBuilder";
import { isReb3lsTrigger, getReb3lsMessage } from "@/lib/chat/easterEgg";
import { buildMainChatSystemPrompt } from "@/lib/chat/systemPrompt";
import { redactSensitiveGameIdentifiers, saveKnowledgeEntries } from "@/lib/chat/knowledgeStore";

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

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function maybeImageLink(url: string) {
  return /\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i.test(url);
}

async function lookupUploadUrls(uploadIds: number[]) {
  if (!uploadIds.length) return [] as string[];

  const sb: any = supabaseAdmin();
  const { data } = await sb.from("uploads").select("id, url, kind").in("id", uploadIds);

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
    const links = asArray<string>(body?.links).map((v) => String(v).trim()).filter(Boolean);
    const uploadIds = asArray<number>(body?.upload_ids)
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v) && v > 0);
    const imageDataUrls = asArray<string>(body?.image_data_urls)
      .map((v) => String(v).trim())
      .filter(Boolean)
      .slice(0, 4);
    const priorMessages = asArray<PriorMessage>(body?.prior_messages)
      .map((m) => ({
        role: String(m?.role ?? "user"),
        text: String(m?.text ?? "").trim(),
      }))
      .filter((m) => m.text);

    if (!message && !links.length && !uploadIds.length && !imageDataUrls.length) {
      return NextResponse.json({ ok: false, error: "No question or material provided." }, { status: 400 });
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

    const systemPrompt = buildMainChatSystemPrompt(context.summary);

    const priorText =
      priorMessages.length
        ? priorMessages.map((m) => `${m.role}: ${m.text}`).join("\n")
        : "None.";

    const reusableTextPrompt = [
      "User request:",
      message || "Analyze the provided material and explain what matters.",
      "",
      "Recent conversation:",
      priorText,
      "",
      links.length ? `Links supplied:\n${links.join("\n")}` : "No links supplied.",
      uploadIds.length ? `Saved upload IDs supplied:\n${uploadIds.join(", ")}` : "No saved upload IDs supplied.",
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
      "Rules:",
      "- Keep the answer clear and useful.",
      "- Save only reusable game knowledge.",
      "- Never reveal, repeat, or save player names, alliance names, or server identifiers.",
      "- If material is uncertain or incomplete, say so.",
      "- The main chat may advise what optimizer settings the user should choose, but must not pretend to have run optimizer or analyzer itself.",
    ].join("\n");

    const userContent: Array<any> = [{ type: "text", text: reusableTextPrompt }];

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
      temperature: 0.2,
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "system",
          content: `Compact context:\n${JSON.stringify(
            {
              heroCount: context.heroCount,
              squadStateLoaded: context.squadStateLoaded,
              battleFileCount: context.battleFileCount,
              optimizerFileCount: context.optimizerFileCount,
              imageLinksProvided: imageLinks.length,
              savedUploadImagesResolved: uploadImageUrls.length,
              directUploadedImagesProvided: imageDataUrls.length,
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

    const answer = redactSensitiveGameIdentifiers(String(parsed?.answer ?? "No answer returned."));

    const knowledgeEntries = Array.isArray(parsed?.knowledge_entries)
      ? parsed.knowledge_entries
          .map((entry) => ({
            category: String(entry?.category ?? "general_observation").trim() || "general_observation",
            subject_key: String(entry?.subject_key ?? "general").trim() || "general",
            title: String(entry?.title ?? "").trim(),
            content: String(entry?.content ?? "").trim(),
            confidence: Math.max(0, Math.min(1, Number(entry?.confidence ?? 0.5))),
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
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Main chat failed" },
      { status: 500 }
    );
  }
}
