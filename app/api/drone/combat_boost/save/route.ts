// app/api/drone/combat_boost/save/route.ts
import { NextResponse } from "next/server";

type SaveBody = {
  owner_id: string;
  value: any; // { kind:"drone_combat_boost", chip_sets:{...}, ... }
  source_urls?: string[];
};

export async function POST(req: Request) {
  let body: SaveBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { owner_id, value, source_urls = [] } = body;

  if (!owner_id) return NextResponse.json({ error: "owner_id is required" }, { status: 400 });
  if (!value || value.kind !== "drone_combat_boost") {
    return NextResponse.json({ error: "value.kind must be drone_combat_boost" }, { status: 400 });
  }

  const key = `${owner_id}:drone:combat_boost`;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
  const res = await fetch(`${baseUrl}/api/facts/upsert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      domain: "drone",
      key,
      value,
      status: "confirmed",
      confidence: 1,
      source_urls,
    }),
  });

  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: json?.error ?? "Save failed" }, { status: res.status });

  return NextResponse.json(json);
}
