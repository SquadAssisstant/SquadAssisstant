import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type AdminClient = ReturnType<typeof createClient<Database>>;

let _client: AdminClient | null = null;

function must(name: string, value?: string | null) {
  if (!value) throw new Error(`${name} is missing`);
  return value;
}

export function supabaseAdmin(): AdminClient {
  if (_client) return _client;

  // Prefer server-only URL if you set it, otherwise fall back to the public one
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  _client = createClient<Database>(
    must("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)", url),
    must("SUPABASE_SERVICE_ROLE_KEY", key),
    { auth: { persistSession: false } }
  );

  return _client;
}
