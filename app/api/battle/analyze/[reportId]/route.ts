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

async function fetchOne(profileId: string, reportId: string) {
  const sb = supabaseAdmin() as any;

  const { data, error } = await sb
    .from("battle_reports")
    .select("id, created_at, parsed")
    .eq("profile_id", profileId)
    .eq("id", reportId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

async function makeDetailedAnswer(message: string, analysis: any, context: any, contextSummary: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return [
      "Detailed mode could not run because OPENAI_API_KEY is missing.",
      "",
      "Saved player data summary:",
      contextSummary,
    ].join("\n");
  }

  const llm = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: "gpt-4o-mini",
    temperature: 0.2,
  });

  const prompt = [
    "You are a battle report analyzer.",
    "Always prioritize saved player data first.",
    "Only use estimation when saved data is missing.",
    "",
    "User question:",
    message || "Explain this battle report.",
    "",
    "Saved player data summary:",
    contextSummary,
    "",
    "Saved player data context JSON:",
    JSON.stringify(context),
    "",
    "Analyzed battle report JSON:",
    JSON.stringify(analysis),
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

export async function GET(req: Request, ctx: { params: Promise<{ reportId: string }> }) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { reportId } = await ctx.params;
    const row = await fetchOne(s.profileId, reportId);

    if (!row) {
      return NextResponse.json({ ok: false, error: "Battle report not found" }, { status: 404 });
    }

    const analysis = analyzeParsedReport(String(row.id), row.parsed ?? {});
    const context = await buildBattleContextFromRequest(req, s.profileId);
    const contextSummary = summarizeBattleContext(context);

    return NextResponse.json({
      ok: true,
      report: row,
      analysis,
      context_summary: contextSummary,
      context,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ reportId: string }> }) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body: any = await req.json().catch(() => ({}));
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const detail = Boolean(body?.detail);

  try {
    const { reportId } = await ctx.params;
    const row = await fetchOne(s.profileId, reportId);

    if (!row) {
      return NextResponse.json({ ok: false, error: "Battle report not found" }, { status: 404 });
    }

    const analysis = analyzeParsedReport(String(row.id), row.parsed ?? {});
    const context = await buildBattleContextFromRequest(req, s.profileId);
    const contextSummary = summarizeBattleContext(context);

    if (!detail) {
      return NextResponse.json({
        ok: true,
        report: row,
        analysis,
        context_summary: contextSummary,
        context,
        answer: "Saved player data has been loaded and merged. Ask for more detail if you want a deeper explanation.",
        mode: "simple",
      });
    }

    const answer = await makeDetailedAnswer(message, analysis, context, contextSummary);

    return NextResponse.json({
      ok: true,
      report: row,
      analysis,
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
