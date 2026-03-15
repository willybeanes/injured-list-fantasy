import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client using the service role key — bypasses RLS and can broadcast
 * Realtime events server-side (e.g. from cron jobs that have no user session).
 * Never expose this client or its key to the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
