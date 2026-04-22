import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
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

async function requireSessionFromReq(req: Request): Promise<{ profileId: string } | null> {
  const token = getCookieFromHeader(req.headers.get("cookie"), sessionCookieName());
  if (!token) return null;
  try {
    const s: any = await verifySession(token);
    return { profileId: String(s.profileId) };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | {
        question?: string;
        optimizer_result?: any;
        saved_optimizer_id?: unknown;
      }
    | null;

  const question = String(body?.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ ok: false, error: "Missing question" }, { status: 400 });
  }

  let optimizerResult = body?.optimizer_result ?? null;

  if (!optimizerResult && body?.saved_optimizer_id != null) {
    const savedId = Number(body.saved_optimizer_id);
    if (Number.isFinite(savedId)) {
      const sb: any = supabaseAdmin();
      const row = await sb
        .from("optimizer_saved_runs")
        .select("id, profile_id, label, mode, squad_count, locked_heroes, result, note, created_at, updated_at")
        .eq("id", savedId)
        .eq("profile_id", s.profileId)
        .maybeSingle();

      if (row.error) {
        return NextResponse.json({ ok: false, error: row.error.message }, { status: 500 });
      }
      if (!row.data) {
        return NextResponse.json({ ok: false, error: "Saved optimizer file not found" }, { status: 404 });
      }

      optimizerResult = {
        ...row.data.result,
        _saved_file_meta: {
          id: row.data.id,
          label: row.data.label,
          mode: row.data.mode,
          squad_count: row.data.squad_count,
          locked_heroes: row.data.locked_heroes,
          note: row.data.note,
          created_at: row.data.created_at,
        },
      };
    }
  }

  if (!optimizerResult) {
    return NextResponse.json({ ok: false, error: "Missing optimizer_result or saved_optimizer_id" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      ok: true,
      answer:
        "Optimizer explanation is unavailable because OPENAI_API_KEY is missing. The saved optimizer context was found, but live explanation requires the model.",
    });
  }

  try {
    const client = new OpenAI({ apiKey });

    const prompt = [
      "You are explaining an already-generated squad optimizer result for a game player.",
      "Use only the provided optimizer result context.",
      "Explain clearly and simply first.",
      "Be direct about why heroes were chosen, why they were placed where they were, and why gear was assigned as it was.",
      "If the question asks about tradeoffs, explain what changed under the optimizer mode.",
      "If the result came from a saved optimizer file, you may mention that file label if helpful.",
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
