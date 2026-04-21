import { NextResponse } from "next/server";
import {
  buildBattleContextFromRequest,
  requireSessionFromReq,
  summarizeBattleContext,
} from "@/app/api/battle/_lib/context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await requireSessionFromReq(req);
  if (!s) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const context = await buildBattleContextFromRequest(req, s.profileId);
    return NextResponse.json({
      ok: true,
      context,
      summary: summarizeBattleContext(context),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
