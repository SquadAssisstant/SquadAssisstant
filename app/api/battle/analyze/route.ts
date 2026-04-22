import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildBattleContextFromRequest,
  summarizeBattleContext,
} from "@/app/api/battle/_lib/context";
import { analyzeParsedReport } from "@/app/api/battle/_lib/analyzer";

type BattleRow = {
  id: number | string;
  profile_id?: string | null;
  created_at?: string | null;
  parsed?: any;
};

type AnalyzeResponse = {
  ok: boolean;
  fetched?: number;
  battleCount?: number;
  summary: string;
  context_summary: string;
  context?: any;
  analyses?: Array<{
    id: number | string;
    created_at: string | null;
    analysis: any;
  }>;
  answer?: string;
  mode?: string;
  error?: string;
};

function parseLimit(value: string | null, fallback = 200, max = 500) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

function lines(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v ?? ""));
  if (typeof value === "string") return value.split("\n");
  if (value == null) return [];
  return [String(value)];
}

async function loadBattleRows(limit: number): Promise<BattleRow[]> {
  const sb: any = supabaseAdmin();

  const { data, error } = await sb
    .from("battle_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message || "Failed to load battle reports");
  }

  return Array.isArray(data) ? (data as BattleRow[]) : [];
}

function buildAnalyses(rows: BattleRow[]) {
  return rows.map((r) => ({
    id: r.id,
    created_at: r.created_at ?? null,
    analysis: analyzeParsedReport(r.parsed ?? {}),
  }));
}

function buildSummary(
  rows: BattleRow[],
  contextSummary: string
): string {
  const output: string[] = [];

  output.push("Battle report analyzer");
  output.push(`Reports loaded: ${rows.length}`);

  if (rows.length > 0) {
    output.push(
      `Newest report: #${rows[0].id} • ${rows[0].created_at ?? "unknown"}`
    );
  } else {
    output.push("No reports found.");
  }

  output.push("");
  output.push("Saved player data loaded first.");
  output.push(contextSummary || "No context summary available.");

  return output.join("\n");
}

function buildAnswer(
  question: string,
  analyses: ReturnType<typeof buildAnalyses>,
  contextSummary: string
): string {
  const out: string[] = [];

  out.push(`Question: ${question}`);
  out.push("");

  if (!analyses.length) {
    out.push("No battle reports available.");
  } else {
    out.push(`Reports reviewed: ${analyses.length}`);
    out.push("");

    analyses.slice(0, 15).forEach((entry, index) => {
      out.push(
        `Report ${index + 1} • ID ${entry.id} • ${
          entry.created_at ?? "unknown"
        }`
      );

      const summaryLines = lines(entry.analysis?.summary);
      if (summaryLines.length) {
        out.push(...summaryLines);
      } else {
        out.push("No report summary available.");
      }

      out.push("");
    });
  }

  out.push("Saved Player Context:");
  out.push(contextSummary || "No context summary available.");

  return out.join("\n");
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseLimit(url.searchParams.get("limit"));

    const rows = await loadBattleRows(limit);
    const analyses = buildAnalyses(rows);

    const context = await buildBattleContextFromRequest(req);
    const contextSummary = summarizeBattleContext(context);

    const response: AnalyzeResponse = {
      ok: true,
      fetched: rows.length,
      battleCount: rows.length,
      summary: buildSummary(rows, contextSummary),
      context_summary: contextSummary,
      context,
      analyses,
    };

    return NextResponse.json(response);
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        summary: "",
        context_summary: "",
        error: e?.message ?? "Failed to load battle analyzer",
      },
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
        : "Analyze my battle reports using saved player data first, then fill gaps with estimation.";

    const limit = parseLimit(
      body?.limit != null ? String(body.limit) : null
    );

    const rows = await loadBattleRows(limit);
    const analyses = buildAnalyses(rows);

    const context = await buildBattleContextFromRequest(req);
    const contextSummary = summarizeBattleContext(context);

    const response: AnalyzeResponse = {
      ok: true,
      mode: "aggregate",
      summary: buildSummary(rows, contextSummary),
      context_summary: contextSummary,
      context,
      analyses,
      answer: buildAnswer(message, analyses, contextSummary),
    };

    return NextResponse.json(response);
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        summary: "",
        context_summary: "",
        error: e?.message ?? "Battle analyzer failed",
      },
      { status: 500 }
    );
  }
}
