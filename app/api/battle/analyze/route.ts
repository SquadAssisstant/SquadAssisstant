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

function safeString(x: unknown): string {
  if (typeof x === "string") return x;
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

/**
 * IMPORTANT:
 * We want the analyzer to respond naturally to:
 * - "why did I lose" / "why did I win"
 * - "strengths" / "weaknesses"
 * - "what should I change" / "what went wrong"
 * without forcing exact menu commands.
 *
 * But we STILL want "simple first" unless they explicitly ask to go deeper.
 */
function looksLikeDetailRequest(message: string): boolean {
  const m = message.toLowerCase();

  // If the user explicitly asks to go deeper, that's detail mode.
  const explicitDetail = [
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

  if (explicitDetail) return true;

  // Natural questions should still be handled well, but we can do it in
  // "guided simple" mode unless they also ask for deeper detail.
  // We'll return false here and handle these separately.
  return false;
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

function makeSimpleSummary(analyses: AnalysisRow[]): string {
  const n = analyses.length;
  const latest = analyses[0]?.created_at ? `Latest: ${analyses[0].created_at}` : "Latest: unknown";

  return [
    "Battle report analyzer (simple mode)",
    `Reports found: ${n}`,
    latest,
    "",
    'Tip: Ask a specific question (example: "why did I lose?"), or say "explain more" if you want a deeper breakdown.',
  ].join("\n");
}

function makeGuidedAnswer(message: string, analyses: AnalysisRow[]): string {
  // This is intentionally "simple first".
  // We do NOT use an LLM here.
  // We use what your analyzeParsedReport already returns (dominant types, lineup bonus tier, notes).
  const top = analyses.slice(0, 12);

  // Quick aggregations (safe + simple)
  let domA: Record<string, number> = { tank: 0, air: 0, missile: 0, none: 0 };
  let domB: Record<string, number> = { tank: 0, air: 0, missile: 0, none: 0 };
  let tierA: Record<string, number> = {};
  let tierB: Record<string, number> = {};

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
  lines.push("Here’s the simple read (based on your most recent reports):");
  lines.push("");
  lines.push(`• Side A dominant troop types (recent): ${pickTop(domA)}`);
  lines.push(`• Side B dominant troop types (recent): ${pickTop(domB)}`);
  lines.push(`• Side A lineup tiers (recent): ${pickTop(tierA)}`);
  lines.push(`• Side B lineup tiers (recent): ${pickTop(tierB)}`);
  lines.push("");
  lines.push(
    'If you tell me **which report** (or describe the matchup) and ask **"explain more"**, I can go deeper.'
  );

  // Tailor a tiny bit to the user message without getting long.
  if (message.toLowerCase().includes("weakness")) {
    lines.unshift("Weakness quick-check:");
    lines.push("");
    lines.push("Quick weakness pattern to check next:");
    lines.push("• Are you running a mixed troop lineup (lower bonus tier) while the opponent is stacked?");
    lines.push("• If your dominant type is known, check the type-advantage mismatch (tank/air/missile triangle).");
  } else if (message.toLowerCase().includes("strength")) {
    lines.unshift("Strength quick-check:");
    lines.push("");
    lines.push("Quick strength pattern to notice:");
    lines.push("• Higher lineup tier (more same-type heroes) usually shows up as a consistent advantage.");
    lines.push("• If your dominant type matches the favorable type triangle vs the opponent, you’ll trend upward.");
  }

  return lines.join("\n");
}

/** GET: quick debug in browser */
export async function GET(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 500);

  try {
    const rows = await fetchRows(s.profileId, limit);

    // Only battle reports:
    const battleOnly = rows.filter((r) => r?.parsed?.kind === "battle_report");

    const analyses: AnalysisRow[] = battleOnly.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      analysis: analyzeParsedReport(String(r.id), r.parsed ?? {}), // ✅ always string
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
 * { limit?: number, message?: string, detail?: boolean }
 *
 * Behavior:
 * - Always returns simple summary.
 * - Returns short guided answers for natural questions.
 * - Only uses LLM if user explicitly asks for deeper detail OR detail=true.
 */
export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body: any = await req.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body?.limit ?? 200), 1), 500);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const detailFlag = Boolean(body?.detail);

  // Only go "detailed LLM mode" if they explicitly request it.
  const wantsDetail = detailFlag || (message ? looksLikeDetailRequest(message) : false);

  try {
    const rows = await fetchRows(s.profileId, limit);
    const battleOnly = rows.filter((r) => r?.parsed?.kind === "battle_report");

    const analyses: AnalysisRow[] = battleOnly.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      analysis: analyzeParsedReport(String(r.id), r.parsed ?? {}), // ✅ always string
    }));

    const simpleSummary = makeSimpleSummary(analyses);

    if (analyses.length === 0) {
      return NextResponse.json({
        ok: true,
        count: 0,
        summary: "No saved battle report records were found yet.\nUpload battle report screenshots first.",
        answer: message
          ? "I do not have saved battle report data yet. Upload screenshots, then ask again."
          : "",
        mode: "simple",
      });
    }

    // If no message, just return the simple summary.
    if (!message) {
      return NextResponse.json({
        ok: true,
        count: analyses.length,
        summary: simpleSummary,
        answer: "",
        mode: "simple",
      });
    }

    // Natural questions get a helpful response WITHOUT needing exact menu commands.
    if (!wantsDetail && looksLikeNaturalBattleQuestion(message)) {
      return NextResponse.json({
        ok: true,
        count: analyses.length,
        summary: simpleSummary,
        answer: makeGuidedAnswer(message, analyses),
        mode: "simple",
      });
    }

    // If they didn't ask for detail, keep it simple and prompt them how to go deeper.
    if (!wantsDetail) {
      return NextResponse.json({
        ok: true,
        count: analyses.length,
        summary: simpleSummary,
        answer:
          'I can help.\nAsk: "why did I lose?" / "why did I win?" / "strengths" / "weaknesses" — or say "explain more" for deeper detail.',
        mode: "simple",
      });
    }

    // Detailed mode: requires an LLM key.
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        ok: true,
        count: analyses.length,
        summary: simpleSummary,
        answer:
          "Detailed mode needs an LLM provider key.\nYou can still use simple mode for free, or add an LLM key to enable detailed explanations.",
        mode: "simple",
      });
    }

    // Compact context to keep token size sane.
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
- Give a concise answer first. Then add one short line: "If you want deeper detail, say: explain more".

Player message:
${message}

Data (recent analyses):
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
