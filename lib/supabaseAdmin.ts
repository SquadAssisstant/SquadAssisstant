import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type AdminClient = ReturnType<typeof createClient<Database>>;

let _client: AdminClient | null = null;

export function supabaseAdmin(): AdminClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("SUPABASE_URL is missing");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");

  _client = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });

  return _client;
}
