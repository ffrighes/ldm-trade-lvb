// Supabase client with hardcoded fallbacks so the apikey is always set in
// the production bundle, even if the build pipeline fails to inline the
// env vars. The publishable (anon) key is intentionally non-secret — it's
// designed to be public and is protected by RLS at the database layer.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const FALLBACK_URL = 'https://fahnoyptdvnjgubonakg.supabase.co';
const FALLBACK_PUBLISHABLE_KEY = 'sb_publishable_uHPOfjlJj21V2q9sYpvqYA_IYlaLX4O';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
