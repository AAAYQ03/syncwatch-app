import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function assertEnv(): { url: string; key: string } {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  return { url: SUPABASE_URL, key: SUPABASE_ANON_KEY };
}

let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (browserClient) return browserClient;
  const { url, key } = assertEnv();
  browserClient = createBrowserClient(url, key);
  return browserClient;
}

/** Server-side (API routes, RSC). Not cached — create per request. */
export function getServerSupabase(): SupabaseClient {
  const { url, key } = assertEnv();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
