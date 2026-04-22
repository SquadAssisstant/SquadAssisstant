import { NextResponse } from "next/server";
import OpenAI from "openai";
import { sessionCookieName, verifySession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getCookieFromHeader(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
  }
  return undefined;
}

async function requireSessionFromReq(req: Request): Promise<boolean> {
  const token = getCookieFromHeader(req.headers.get("cookie"), sessionCookieName());
  if (!token) return false;
  try {
    await verifySession(token);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const okSession = await requireSessionFromReq(req);
  if (!okSession) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | {
        question?: string;
        optimizer_result?: any;
      }
    | null;

  const question = String(body?.question ?? "").trim();
  const optimizerResult = body?.optimizer_result;

  if (!question) {
    return NextResponse.json({ ok: false, error: "Missing question" }, { status: 400 });
  }
  if (!optimizerResult) {
    return NextResponse.json({ ok: false, error: "Missing optimizer_result" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const fallback = [
      "Optimizer explanation is unavailable because OPENAI_API_KEY is missing.",
      "Saved result context was received, but live conversational explanation needs the model.",
    ].join(" ");

    return NextResponse.json({ ok: true, answer: fallback });
  }

  try {
    const client = new OpenAI({ apiKey });

    const prompt = [
      "You are explaining an already-generated squad optimizer result for a game player.",
      "Use only the provided optimizer result context.",
      "Explain clearly and simply first.",
      "Be direct about why heroes were chosen, why they were placed where they were, and why gear was assigned as it was.",
      "If the question asks for tradeoffs, explain what changed under the optimizer mode.",
      "",
      "OPTIMIZER RESULT JSON:",
      JSON.stringify(optimizerResult, null, 2),
      "",
      "USER QUESTION:",
      question,
    ].join("\n");

    const resp = await client.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
      temperature: 0.3,
    });

    return NextResponse.json({
      ok: true,
      answer: resp.output_text || "No explanation returned.",
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Optimizer chat failed" },
      { status: 500 }
    );
  }
}
