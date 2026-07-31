import { createClient } from '@supabase/supabase-js';

/** Node doesn't read .env.local on its own the way Next does. */
export function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      process.loadEnvFile(file);
    } catch {
      // Missing file is fine — the vars may already be in the environment.
    }
  }
}

/** Returns a service-role client, or null when Supabase isn't configured. */
export function supabaseFromEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createClient(url, key, { auth: { persistSession: false } });
}
