import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";
import { analyzeParsedReport } from "@/app/api/battle/_lib/analyzer";
import { ChatOpenAI } from "@langchain/openai";

type AnalysisRow = {
  id: number | string;
  created_at: string | null;
  analysis: unknown;
};

type CompactRow = {
  id: number | string;
  created_at: string | null;
  analysis: unknown;
};

function getCookieFromHeader(
  cookieHeader: string | null,
  name: string
): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) {
      return decodeURIComponent(p.slice(name.length + 1));
    }
  }
  return undefined;
}

async function requireSessionFromReq(req: Request): Promise<{ profileId: string } | null> {
  const token = getCookieFromHeader(req.headers.get("cookie"), sessionCookieName());
  if (!token) return null;
  try {
    const s = await verifySession(token);
    // We only rely on profileId in this route.
    return { profileId: String((s as any).profileId) };
  } catch {
    return null;
  }
}

async function fetchBattleReportAnalyses(profileId: string, limit: number): Promise<AnalysisRow[]> {
  const sb = supabaseAdmin() as any;

  const { data, error } = await sb
    .from("battle_reports")
    .select("id, created_at, parsed")
    .eq("profile_id", profileId)
    .order("id", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const rows: any[] = Array.isArray(data) ? data : [];

  // Filter locally to battle_report only (safe even if table stores other kinds).
  const battleOnly = rows.filter((r: any) => r?.parsed?.kind === "battle_report");

  const analyses: AnalysisRow[] = battleOnly.map((r: any) => ({
    id: r.id,
    created_at: r.created_at ?? null,
    analysis: analyzeParsedReport(r.id, r.parsed ?? {}),
  }));

  return analyses;
}

/**
 * GET: Debug batch analysis.
 * Example: /api/battle/analyze?limit=200
 */
export async function GET(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitRaw ?? 200), 1), 500);

  try {
    const analyses = await fetchBattleReportAnalyses(s.profileId, limit);
    return NextResponse.json({ ok: true, count: analyses.length, analyses });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to analyze";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST: Chat-ready analyzer.
 * Body:
 *  { limit?: number, message?: string }
 * Returns:
 *  { ok, count, summary, answer }
 */
export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: unknown = await req.json().catch(() => ({}));
  const bodyObj = (body && typeof body === "object") ? (body as Record<string, unknown>) : {};

  const limitRaw = bodyObj["limit"];
  const limit = Math.min(Math.max(Number(limitRaw ?? 200), 1), 500);

  const messageRaw = bodyObj["message"];
  const message =
    typeof messageRaw === "string" ? messageRaw.trim() : "";

  try {
    const analyses = await fetchBattleReportAnalyses(s.profileId, limit);

    if (analyses.length === 0) {
      return NextResponse.json({
        ok: true,
        count: 0,
        summary:
          "No saved battle report records were found yet for your profile. Upload battle report screenshots first.",
        answer: message
          ? "I do not have saved battle report data yet. Upload screenshots, then ask again."
          : "",
      });
    }

    // Compact context to keep token size sane.
    const compact: CompactRow[] = analyses.slice(0, 80).map((x: AnalysisRow) => ({
      id: x.id,
      created_at: x.created_at,
      analysis: x.analysis,
    }));

    const model = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.2,
    });

    const summaryPrompt = `
You are the Battle Report Analyzer.
You have already-extracted analyses for battle report screenshots (not raw images).

Hard rules:
- Attacker/defender names or IDs, timestamps, and map coordinates are NOT available and must not be requested.
- Focus on why wins/losses happened, lineup patterns, and actionable changes.

Return a structured summary:
1) Patterns (wins/losses by lineup archetype)
2) Top 5 consistent failure causes
3) Top 5 high-leverage fixes
4) A short checklist for the next battle

DATA:
${JSON.stringify(compact).slice(0, 120000)}
`.trim();

    const summaryOut = await model.invoke(summaryPrompt);
    const summary = String((summaryOut as any)?.content ?? "");

    let answer = "";
    if (message) {
      const answerPrompt = `
You are the Battle Report Analyzer in a conversation with a player.
Use the analyses and the summary to answer their question.
Match the player's tone and vocabulary. Be practical.

Player message:
${message}

Summary:
${summary.slice(0, 12000)}

Analyses sample:
${JSON.stringify(compact.slice(0, 30)).slice(0, 120000)}
`.trim();

      const answerOut = await model.invoke(answerPrompt);
      answer = String((answerOut as any)?.content ?? "");
    }

    return NextResponse.json({
      ok: true,
      count: analyses.length,
      summary,
      answer,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to analyze";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
