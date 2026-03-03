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

function stripHistory(v: any) {
  if (!v || typeof v !== "object") return v;
  const copy: any = { ...v };
  delete copy._history;
  return copy;
}

function withHistory(nextValue: any, prevValue: any) {
  const at = nowIso();

  const prevHistory =
    prevValue && typeof prevValue === "object" && Array.isArray(prevValue._history)
      ? prevValue._history
      : [];

  const snapshot = stripHistory(prevValue);

  const nextHistory = [{ at, value: snapshot }, ...prevHistory].slice(0, 50);

  if (nextValue && typeof nextValue === "object") {
    return { ...nextValue, _history: nextHistory };
  }

  return { value: nextValue, _history: nextHistory };
}

export async function POST(req: Request) {
  const supabase = supabaseAdmin();

  let body: UpsertBody;
  try {
    body = (await req.json()) as UpsertBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { domain, key, value, status = "confirmed", confidence = 1, source_urls = [] } = body;

  if (!domain || !key) {
    return NextResponse.json({ error: "domain and key are required" }, { status: 400 });
  }

  // NOTE: We intentionally cast to any here so this route does NOT depend on Database types
  // being perfectly in sync with your Supabase schema.
  const prevRes: any = await (supabase as any)
    .from("facts")
    .select("id, value")
    .eq("key", key)
    .maybeSingle();

  if (prevRes?.error) {
    return NextResponse.json({ error: prevRes.error.message ?? String(prevRes.error) }, { status: 500 });
  }

  const prevValue = prevRes?.data?.value;
  const mergedValue = prevValue ? withHistory(value, prevValue) : value;

  const upRes: any = await (supabase as any)
    .from("facts")
    .upsert(
      {
        domain,
        key,
        value: mergedValue,
        status,
        confidence,
        source_urls,
        updated_at: nowIso(),
      },
      { onConflict: "key" }
    )
    .select("*")
    .single();

  if (upRes?.error) {
    return NextResponse.json({ error: upRes.error.message ?? String(upRes.error) }, { status: 500 });
  }

  return NextResponse.json({ row: upRes.data });
}
