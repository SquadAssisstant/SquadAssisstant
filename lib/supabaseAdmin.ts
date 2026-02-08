import { createClient } from "@supabase/supabase-js";

export type AdminClient = ReturnType<typeof createClient>;

let _client: AdminClient | null = null;

export function supabaseAdmin(): AdminClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("SUPABASE_URL is missing");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");

  _client = createClient(url, key, {
    auth: { persistSession: false },
  });

  return _client;
}
