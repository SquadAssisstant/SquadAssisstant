import { NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { analyzeParsedReport } from "@/app/api/battle/_lib/analyzer";
import {
  buildBattleContextFromRequest,
  requireSessionFromReq,
  summarizeBattleContext,
} from "@/app/api/battle/_lib/context";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FetchedRow = {
  id: number | string;
  created_at: string | null;
  parsed: any;
};

type AnalysisRow = {
  id: number | string;
  created_at: string | null;
  analysis: any;
};

async function fetchRows(profileId: string, limit: number): Promise<FetchedRow[]> {
  const sb = supabaseAdmin() as any;

  const { data, error } = await sb
    .from("battle_reports")
    .select("id, created_at, parsed")
    .eq("profile_id", profileId)
    .order("id", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const rows: any[] = Array.isArray(data) ? data : [];
  return rows.map((r: any) => ({
    id: r.id,
    created_at: r.created_at ?? null,
    parsed: r.parsed ?? null,
  }));
}

function makeSimpleSummary(analyses: AnalysisRow[], contextSummary: string): string {
  const n = analyses.length;
  const latest = analyses[0]?.created_at ? `Latest: ${analyses[0].created_at}` : "Latest: unknown";

  return [
    "Battle report analyzer",
    `Reports found: ${n}`,
    latest,
    "",
    "Saved player data loaded first.",
    contextSummary,
  ].join("\n");
}

function looksLikeDetailRequest(message: string): boolean {
  const m = message.toLowerCase();
  return [
    "explain more",
    "more detail",
    "more details",
    "break down",
    "breakdown",
    "in depth",
    "deep dive",
    "step by step",
    "show the math",
    "show math",
    "full analysis",
    "expand",
  ].some((t) => m.includes(t));
}

function looksLikeNaturalBattleQuestion(message: string): boolean {
  const m = message.toLowerCase();
  const triggers = [
    "why did i lose",
    "why did i win",
    "why did we lose",
    "why did we win",
    "what went wrong",
    "what did i do wrong",
    "what should i change",
    "what can i improve",
    "strength",
    "strengths",
    "weakness",
    "weaknesses",
    "counter",
    "counters",
    "matchup",
    "matchups",
    "how do i beat",
    "how to beat",
    "what lineup",
    "which lineup",
  ];
  return triggers.some((t) => m.includes(t));
}

function makeGuidedAnswer(message: string, analyses: AnalysisRow[], contextSummary: string): string {
  const top = analyses.slice(0, 12);

  const domA: Record<string, number> = { tank: 0, air: 0, missile: 0, none: 0 };
  const domB: Record<string, number> = { tank: 0, air: 0, missile: 0, none: 0 };
  const tierA: Record<string, number> = {};
  const tierB: Record<string, number> = {};

  for (const r of top) {
    const a = r.analysis?.sides?.A;
    const b = r.analysis?.sides?.B;

    const da = a?.dominantType ?? null;
    const db = b?.dominantType ?? null;

    domA[da ?? "none"] = (domA[da ?? "none"] ?? 0) + 1;
    domB[db ?? "none"] = (domB[db ?? "none"] ?? 0) + 1;

    const ta = a?.lineup?.tier ?? "unknown";
    const tb = b?.lineup?.tier ?? "unknown";

    tierA[ta] = (tierA[ta] ?? 0) + 1;
    tierB[tb] = (tierB[tb] ?? 0) + 1;
  }

  const pickTop = (obj: Record<string, number>) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

  const lines: string[] = [];
  lines.push("Here’s the simple read:");
  lines.push("");
  lines.push(`• Side A dominant troop types (recent): ${pickTop(domA)}`);
  lines.push(`• Side B dominant troop types (recent): ${pickTop(domB)}`);
  lines.push(`• Side A lineup tiers (recent): ${pickTop(tierA)}`);
  lines.push(`• Side B lineup tiers (recent): ${pickTop(tierB)}`);
  lines.push("");
  lines.push("Saved player data snapshot:");
  lines.push(contextSummary);

  if (message.toLowerCase().includes("weakness")) {
    lines.push("");
    lines.push("Quick weakness checks:");
    lines.push("• Look for mixed lineup bonus tiers versus stacked same-type squads.");
    lines.push("• Check whether your current hero, drone, or overlord setup is incomplete for the squad used.");
  } else if (message.toLowerCase().includes("strength")) {
    lines.push("");
    lines.push("Quick strength checks:");
    lines.push("• Strong saved squad cohesion usually shows up as higher lineup consistency.");
    lines.push("• Fully built heroes plus matching drone and overlord progress usually raise stability.");
  }

  lines.push("");
  lines.push('Ask "explain more" if you want a deeper merged analysis.');

  return lines.join("\n");
}

async function makeDetailedAnswer(
  message: string,
  analyses: AnalysisRow[],
  context: any,
  contextSummary: string
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return [
      "Detailed mode could not run because OPENAI_API_KEY is missing.",
      "",
      "Simple merged summary:",
      contextSummary,
    ].join("\n");
  }

  const llm = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4o-mini",
    temperature: 0.2,
  });

  const compactReports = analyses.slice(0, 10).map((r) => ({
    id: r.id,
    created_at: r.created_at,
    analysis: r.analysis,
  }));

  const prompt = [
    "You are a battle report analyzer.",
    "Always prioritize saved player data first.",
    "Only use estimation when saved data is missing.",
    "",
    "User question:",
    message,
    "",
    "Saved player data summary:",
    contextSummary,
    "",
    "Saved player data context JSON:",
    JSON.stringify(context),
    "",
    "Recent analyzed battle report JSON:",
    JSON.stringify(compactReports),
    "",
    "Return a clear answer with these sections:",
    "1. Main reason for result",
    "2. Squad / hero / drone / overlord factors",
    "3. Missing data caveats",
    "4. Best next upgrades or adjustments",
  ].join("\n");

  const resp = await llm.invoke(prompt);
  return typeof resp.content === "string" ? resp.content : JSON.stringify(resp.content);
}

export async function GET(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 500);

  try {
    const rows = await fetchRows(s.profileId, limit);
    const battleOnly = rows.filter((r) => r?.parsed?.kind === "battle_report");

    const analyses: AnalysisRow[] = battleOnly.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      analysis: analyzeParsedReport(String(r.id), r.parsed ?? {}),
    }));

    const context = await buildBattleContextFromRequest(req, s.profileId);
    const contextSummary = summarizeBattleContext(context);

    return NextResponse.json({
      ok: true,
      fetched: rows.length,
      battleCount: analyses.length,
      summary: makeSimpleSummary(analyses, contextSummary),
      context_summary: contextSummary,
      context,
      analyses,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body: any = await req.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body?.limit ?? 200), 1), 500);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const wantsDetail = Boolean(body?.detail) || (message ? looksLikeDetailRequest(message) : false);

  try {
    const rows = await fetchRows(s.profileId, limit);
    const battleOnly = rows.filter((r) => r?.parsed?.kind === "battle_report");

    const analyses: AnalysisRow[] = battleOnly.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      analysis: analyzeParsedReport(String(r.id), r.parsed ?? {}),
    }));

    const context = await buildBattleContextFromRequest(req, s.profileId);
    const contextSummary = summarizeBattleContext(context);
    const simpleSummary = makeSimpleSummary(analyses, contextSummary);

    if (analyses.length === 0) {
      return NextResponse.json({
        ok: true,
        count: 0,
        summary: "No saved battle report records were found yet.\nUpload battle report screenshots first.",
        context_summary: contextSummary,
        context,
        answer: message ? "I do not have saved battle report data yet. Upload battle reports, then ask again." : "",
        mode: "simple",
      });
    }

    if (!message) {
      return NextResponse.json({
        ok: true,
        count: analyses.length,
        summary: simpleSummary,
        context_summary: contextSummary,
        context,
        answer: "",
        mode: "simple",
      });
    }

    if (!wantsDetail && looksLikeNaturalBattleQuestion(message)) {
      return NextResponse.json({
        ok: true,
        count: analyses.length,
        summary: simpleSummary,
        context_summary: contextSummary,
        context,
        answer: makeGuidedAnswer(message, analyses, contextSummary),
        mode: "simple",
      });
    }

    if (!wantsDetail) {
      return NextResponse.json({
        ok: true,
        count: analyses.length,
        summary: simpleSummary,
        context_summary: contextSummary,
        context,
        answer:
          'I can help.\nAsk: "why did I lose?" / "why did I win?" / "strengths" / "weaknesses" — or say "explain more" for deeper detail.',
        mode: "simple",
      });
    }

    const answer = await makeDetailedAnswer(message, analyses, context, contextSummary);

    return NextResponse.json({
      ok: true,
      count: analyses.length,
      summary: simpleSummary,
      context_summary: contextSummary,
      context,
      answer,
      mode: "detailed",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
