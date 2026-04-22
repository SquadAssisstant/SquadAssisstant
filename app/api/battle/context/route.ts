import { NextResponse } from "next/server";

import {
  buildBattleContextFromRequest,
  summarizeBattleContext,
} from "@/app/api/battle/_lib/context";

export async function GET(req: Request) {
  try {
    const context = await buildBattleContextFromRequest(req);
    const contextSummary = summarizeBattleContext(context);

    return NextResponse.json({
      ok: true,
      context,
      context_summary: contextSummary,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? "Failed to load battle context",
      },
      { status: 500 }
    );
  }
}
