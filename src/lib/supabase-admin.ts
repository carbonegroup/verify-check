import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Privileged Supabase client. Import only from Route Handlers / server code.
 * Never expose SUPABASE_SERVICE_ROLE_KEY via NEXT_PUBLIC_* or to a client component.
 */
export function createSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !url.startsWith("https://") || !serviceKey) {
    throw new Error("Configuration serveur Supabase incomplète.");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
