import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildBattleContextFromRequest,
  summarizeBattleContext,
} from "@/app/api/battle/_lib/context";
import { analyzeParsedReport } from "@/app/api/battle/_lib/analyzer";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limitRaw = Number(url.searchParams.get("limit") ?? "50");
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 50;

    const sb: any = supabaseAdmin();

    const { data: rows, error } = await sb
      .from("battle_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to load battle reports" },
        { status: 500 }
      );
    }

    const context = await buildBattleContextFromRequest(req);
    const contextSummary = summarizeBattleContext(context);

    const analyses = Array.isArray(rows)
      ? rows.map((r: any) => ({
          id: r.id,
          created_at: r.created_at ?? null,
          analysis: analyzeParsedReport({
            parsedReport: r.parsed ?? {},
            context,
          }),
        }))
      : [];

    return NextResponse.json({
      ok: true,
      fetched: Array.isArray(rows) ? rows.length : 0,
      battleCount: Array.isArray(rows) ? rows.length : 0,
      context,
      context_summary: contextSummary,
      summary: `Loaded ${Array.isArray(rows) ? rows.length : 0} battle report(s).`,
      analyses,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Failed to load battle analyzer" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const message =
      typeof body?.message === "string" && body.message.trim()
        ? body.message.trim()
        : "Analyze my battle performance using saved player data first, then fill gaps with estimation.";

    const limitRaw = Number(body?.limit ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 50;

    const sb: any = supabaseAdmin();

    const { data: rows, error } = await sb
      .from("battle_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to load battle reports" },
        { status: 500 }
      );
    }

    const context = await buildBattleContextFromRequest(req);
    const contextSummary = summarizeBattleContext(context);

    const analyses = Array.isArray(rows)
      ? rows.map((r: any) =>
          analyzeParsedReport({
            parsedReport: r.parsed ?? {},
            context,
          })
        )
      : [];

    const summaryLines: string[] = [];
    summaryLines.push(`Question: ${message}`);
    summaryLines.push("");
    summaryLines.push(`Reports considered: ${Array.isArray(rows) ? rows.length : 0}`);
    summaryLines.push(`Context: ${contextSummary}`);
    summaryLines.push("");

    if (analyses.length) {
      summaryLines.push("Per-report summaries:");
      analyses.forEach((entry: any, idx: number) => {
        const text = Array.isArray(entry?.summary)
          ? entry.summary.join(" | ")
          : String(entry?.summary ?? "No summary available.");
        summaryLines.push(`${idx + 1}. ${text}`);
      });
    } else {
      summaryLines.push("No parsed battle reports available.");
    }

    return NextResponse.json({
      ok: true,
      mode: "aggregate",
      context,
      context_summary: contextSummary,
      summary: summaryLines.join("\n"),
      answer: summaryLines.join("\n"),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Battle analyzer failed" },
      { status: 500 }
    );
  }
}
