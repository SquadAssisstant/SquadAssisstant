// app/api/drone/components/save/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type SaveBody = {
  owner_id: string;
  value: any; // { kind:"drone_components", components:[...] }
  source_urls?: string[];
};

function getBaseUrl(req: Request) {
  const envBase = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (envBase) return envBase.replace(/\/+$/, "");
  return new URL(req.url).origin;
}

async function readJsonFromResponse(res: Response) {
  const text = await res.text();

  if (!text || !text.trim()) {
    return {
      ok: false,
      data: null as any,
      rawText: text,
      error: `Empty response body (${res.status} ${res.statusText})`,
    };
  }

  try {
    return {
      ok: true,
      data: JSON.parse(text),
      rawText: text,
      error: null,
    };
  } catch {
    return {
      ok: false,
      data: null as any,
      rawText: text,
      error: `Response was not valid JSON (${res.status} ${res.statusText})`,
    };
  }
}

export async function POST(req: Request) {
  try {
    let body: SaveBody;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { owner_id, value, source_urls = [] } = body;

    if (!owner_id) {
      return NextResponse.json({ error: "owner_id is required" }, { status: 400 });
    }

    if (!value || value.kind !== "drone_components") {
      return NextResponse.json(
        { error: "value.kind must be drone_components" },
        { status: 400 }
      );
    }

    const key = `${owner_id}:drone:components`;
    const baseUrl = getBaseUrl(req);

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/facts/upsert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: req.headers.get("cookie") ?? "",
        },
        body: JSON.stringify({
          domain: "drone",
          key,
          value,
          status: "confirmed",
          confidence: 1,
          source_urls,
        }),
        cache: "no-store",
      });
    } catch (e: any) {
      return NextResponse.json(
        {
          error: "Failed to reach /api/facts/upsert",
          details: e?.message ?? "Unknown fetch error",
        },
        { status: 500 }
      );
    }

    const parsed = await readJsonFromResponse(res);

    if (!res.ok) {
      return NextResponse.json(
        {
          error: parsed.data?.error ?? parsed.error ?? "Save failed",
          status: res.status,
          raw:
            typeof parsed.rawText === "string"
              ? parsed.rawText.slice(0, 500)
              : "",
        },
        { status: res.status || 500 }
      );
    }

    if (!parsed.data) {
      return NextResponse.json(
        {
          error: parsed.error ?? "Save failed: invalid JSON response",
          raw:
            typeof parsed.rawText === "string"
              ? parsed.rawText.slice(0, 500)
              : "",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data);
  } catch (e: any) {
    return NextResponse.json(
      {
        error: e?.message ?? "Unexpected server error while saving drone components",
      },
      { status: 500 }
    );
  }
}
