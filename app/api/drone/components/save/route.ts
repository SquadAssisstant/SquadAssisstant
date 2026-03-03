// app/api/drone/components/save/route.ts
import { NextResponse } from "next/server";

type SaveBody = {
  player_id: string;
  state: any;
  source_urls?: string[];
};

export async function POST(req: Request) {
  let body: SaveBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { player_id, state, source_urls = [] } = body;
  if (!player_id) return NextResponse.json({ error: "player_id is required" }, { status: 400 });
  if (!state || state.kind !== "drone_components") {
    return NextResponse.json({ error: "state.kind must be drone_components" }, { status: 400 });
  }

  const key = `${player_id}:drone:components`;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
  const res = await fetch(`${baseUrl}/api/facts/upsert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      domain: "drone",
      key,
      value: state,
      status: "confirmed",
      confidence: 1,
      source_urls,
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: json?.error ?? "Save failed" }, { status: res.status });
  }
  return NextResponse.json(json);
}
