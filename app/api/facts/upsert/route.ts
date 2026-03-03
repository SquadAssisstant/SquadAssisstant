// app/api/facts/upsert/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type UpsertBody = {
  domain: string;
  key: string;
  value: any;
  status?: string;
  confidence?: number;
  source_urls?: string[];
};

function nowIso() {
  return new Date().toISOString();
}

function withHistory(nextValue: any, prevValue: any) {
  // Keep your current convention: value contains _history array
  const at = nowIso();

  const prevHistory =
    prevValue && typeof prevValue === "object" && Array.isArray(prevValue._history)
      ? prevValue._history
      : [];

  const cleanedPrev = prevValue && typeof prevValue === "object"
    ? (() => {
        const copy = { ...prevValue };
        // prevent nested _history growth like what you saw doubling
        delete (copy as any)._history;
        return copy;
      })()
    : prevValue;

  const nextHistory = [
    { at, value: cleanedPrev },
    ...prevHistory,
  ].slice(0, 50); // cap history growth

  if (nextValue && typeof nextValue === "object") {
    return { ...nextValue, _history: nextHistory };
  }
  return { value: nextValue, _history: nextHistory };
}

export async function POST(req: Request) {
  const supabase = supabaseAdmin();

  let body: UpsertBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { domain, key, value, status = "confirmed", confidence = 1, source_urls = [] } = body;

  if (!domain || !key) {
    return NextResponse.json({ error: "domain and key are required" }, { status: 400 });
  }

  // fetch previous (if any)
  const prev = await supabase
    .from("facts")
    .select("id, value")
    .eq("key", key)
    .maybeSingle();

  if (prev.error) {
    return NextResponse.json({ error: prev.error.message }, { status: 500 });
  }

  const mergedValue = prev.data?.value ? withHistory(value, prev.data.value) : value;

  const upsertRes = await supabase
    .from("facts")
    .upsert(
      {
        domain,
        key,
        value: mergedValue,
        status,
        confidence,
        source_urls,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    )
    .select("*")
    .single();

  if (upsertRes.error) {
    return NextResponse.json({ error: upsertRes.error.message }, { status: 500 });
  }

  return NextResponse.json({ row: upsertRes.data });
}
