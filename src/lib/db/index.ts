import type { Database } from '@/lib/types';

import { localDb } from './local';
import { supabaseDb } from './supabase';

/**
 * Supabase is used whenever it is configured; otherwise everything falls back
 * to a JSON file under `.data/` so the app runs with zero setup in dev.
 */
export const usingSupabase = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export const db: Database = usingSupabase ? supabaseDb : localDb;
