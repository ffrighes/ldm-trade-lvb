// Supabase client with hardcoded fallbacks so the apikey is always set in
// the production bundle, even if the build pipeline fails to inline the
// env vars. The publishable (anon) key is intentionally non-secret — it's
// designed to be public and is protected by RLS at the database layer.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const FALLBACK_URL = 'https://kpnuxyyqcsguaajzgons.supabase.co';
const FALLBACK_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbnV4eXlxY3NndWFhanpnb25zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NzUzMDUsImV4cCI6MjA4ODA1MTMwNX0.Nw-_fVpD83PyJ_AE66WMRzQg9tmZD1Gr4osaeXkYu-Y';

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
