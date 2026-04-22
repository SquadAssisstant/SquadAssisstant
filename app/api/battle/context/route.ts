import { NextResponse } from "next/server";

import {
  buildBattleContextFromRequest,
  summarizeBattleContext,
} from "@/app/api/battle/_lib/context";

export async function GET(req: Request) {
  try {
    const context = await buildBattleContextFromRequest(req);

    return NextResponse.json({
      ok: true,
      context,
      context_summary: summarizeBattleContext(context),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Failed to build battle context" },
      { status: 500 }
    );
  }
}
