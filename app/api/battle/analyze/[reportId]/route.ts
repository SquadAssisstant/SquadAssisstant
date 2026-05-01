import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildBattleContextFromRequest,
  summarizeBattleContext,
} from "@/app/api/battle/_lib/context";
import { analyzeParsedReport } from "@/app/api/battle/_lib/analyzer";

export async function POST(req: Request, context: any) {
  try {
    const reportId = String(context?.params?.reportId ?? "").trim();

    if (!reportId) {
      return NextResponse.json(
        { ok: false, error: "Missing reportId" },
        { status: 400 }
      );
    }

    const sb: any = supabaseAdmin();

    const { data: row, error } = await sb
      .from("battle_reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to load battle report" },
        { status: 500 }
      );
    }

    if (!row) {
      return NextResponse.json(
        { ok: false, error: "Battle report not found" },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const message =
      typeof body?.message === "string" && body.message.trim()
        ? body.message.trim()
        : "Explain this report.";

    const contextData = await buildBattleContextFromRequest(req);
    const contextSummary = summarizeBattleContext(contextData);

    const analysis = analyzeParsedReport({
      parsedReport: row.parsed ?? {},
      context: contextData,
    });

    const summaryText = Array.isArray(analysis?.summary)
      ? analysis.summary.join("\n")
      : String(analysis?.summary ?? "");

    const answer = [
      `Question: ${message}`,
      "",
      "Battle analysis:",
      summaryText || "No summary available.",
      "",
      `Context: ${contextSummary}`,
    ].join("\n");

    return NextResponse.json({
  ok: true,
  mode: "individual",
  reportId,

  context: analysis?.context ?? contextData,
  context_summary: analysis?.context_summary ?? contextSummary,
  summary: summaryText,
  answer,

  comparison: analysis?.comparison ?? null,
  factor_breakdown: analysis?.factor_breakdown ?? null,
  damage_model: analysis?.damage_model ?? null,
  reasons: analysis?.reasons ?? [],
  missing_data: analysis?.missing_data ?? [],
});
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Battle analysis failed" },
      { status: 500 }
    );
  }
}
