import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sessionCookieName, verifySession } from "@/lib/session";
import { analyzeParsedReport } from "@/app/api/battle/_lib/analyzer";
import { ChatOpenAI } from "@langchain/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionLite = { profileId: string };

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

function getCookieFromHeader(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
  }
  return undefined;
}

async function requireSessionFromReq(req: Request): Promise<SessionLite | null> {
  const token = getCookieFromHeader(req.headers.get("cookie"), sessionCookieName());
  if (!token) return null;
  try {
    const s = await verifySession(token);
    return { profileId: String((s as any).profileId) };
  } catch {
    return null;
  }
}

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

function looksLikeDetailRequest(message: string): boolean {
  const m = message.toLowerCase();
  const triggers = [
    "explain",
    "why",
    "break down",
    "breakdown",
    "details",
    "more detail",
    "more info",
    "walk me through",
    "show math",
    "math",
    "step by step",
    "in depth",
    "deep",
    "analyze deeper",
    "full",
    "expand",
  ];
  return triggers.some((t) => m.includes(t));
}

function makeSimpleSummary(analyses: AnalysisRow[]): string {
  const n = analyses.length;
  const latest = analyses[0]?.created_at ? `Latest: ${analyses[0].created_at}` : "Latest: unknown";
  return [
    "Battle report analyzer (simple mode)",
    `Reports found: ${n}`,
    latest,
    "",
    "Tip: Ask a specific question, or say \"explain more\" if you want a deeper breakdown.",
  ].join("\n");
}

function safeString(x: unknown): string {
  if (typeof x === "string") return x;
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

/**
 * GET: debug quickly in browser
 */
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
      analysis: analyzeParsedReport(String(r.id), r.parsed ?? {}), // ✅ FIX
    }));

    return NextResponse.json({
      ok: true,
      fetched: rows.length,
      battleCount: analyses.length,
      summary: makeSimpleSummary(analyses),
      analyses,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * POST: runs ONLY when user triggers it.
 * Body:
 *  { limit?: number, message?: string, detail?: boolean }
 *
 * Behavior:
 * - Always returns simple summary.
 * - Only uses LLM if user explicitly asks for more detail or detail=true.
 */
export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body: any = await req.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body?.limit ?? 200), 1), 500);

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const detailFlag = Boolean(body?.detail);
  const wantsDetail = detailFlag || (message ? looksLikeDetailRequest(message) : false);

  try {
    const rows = await fetchRows(s.profileId, limit);
    const battleOnly = rows.filter((r) => r?.parsed?.kind === "battle_report");

    const analyses: AnalysisRow[] = battleOnly.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      analysis: analyzeParsedReport(String(r.id), r.parsed ?? {}), // ✅ FIX
    }));

    const simpleSummary = makeSimpleSummary(analyses);

    if (analyses.length === 0) {
      return NextResponse.json({
        ok: true,
        count: 0,
        summary:
          "No saved battle report records were found yet. Upload battle report screenshots first.",
        answer: message
          ? "I do not have saved battle report data yet. Upload screenshots, then ask again."
          : "",
        mode: "simple",
      });
    }

    if (!message) {
      return NextResponse.json({
        ok: true,
        count: analyses.length,
        summary: simpleSummary,
        answer: "",
        mode: "simple",
      });
    }

    if (!wantsDetail) {
      return NextResponse.json({
        ok: true,
        count: analyses.length,
        summary: simpleSummary,
        answer:
          "I can help. Ask one specific question about the battle reports (for example: which lineup pattern is losing), or say \"explain more\" if you want a deeper breakdown.",
        mode: "simple",
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        ok: true,
        count: analyses.length,
        summary: simpleSummary,
        answer:
          "Detailed mode needs an LLM provider key. You can still use simple mode for free, or add an LLM key to enable detailed explanations.",
        mode: "simple",
      });
    }

    const compact = analyses.slice(0, 60).map((x: AnalysisRow) => ({
      id: x.id,
      created_at: x.created_at,
      analysis: x.analysis,
    }));

    const model = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.2,
    });

    const prompt = `
You are the Battle Report Analyzer.
Hard rules:
- Attacker/defender names or IDs, timestamps, and map coordinates are not available.
- Keep the answer concise first, then add a short "If you want deeper detail" suggestion.

Player message:
${message}

Data (analyses):
${safeString(compact).slice(0, 120000)}
`.trim();

    const out = await model.invoke(prompt);
    const answer = String((out as any)?.content ?? "");

    return NextResponse.json({
      ok: true,
      count: analyses.length,
      summary: simpleSummary,
      answer,
      mode: "detailed",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
