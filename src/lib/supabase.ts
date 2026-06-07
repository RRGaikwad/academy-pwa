import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

const PLACEHOLDER_MARKERS = ['your_supabase', 'xxxxxxxx'];

export const isSupabaseConfigured = (): boolean => {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  const combined = `${supabaseUrl} ${supabaseAnonKey}`.toLowerCase();
  if (PLACEHOLDER_MARKERS.some((marker) => combined.includes(marker))) return false;
  // Validate that the URL is a proper absolute https URL.
  // A bare project ref like "wdrnavabaywcfjpaqxzx" (no protocol) would fail here,
  // causing a fast, clear error instead of hanging on a malformed network request.
  try {
    const url = new URL(supabaseUrl);
    return url.protocol === 'https:' && url.hostname.length > 0;
  } catch {
    return false;
  }
};

if (!isSupabaseConfigured()) {
  console.error(
    '[VidyaSphere] Supabase is not configured. Create a `.env` file from `.env.example` with your real VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart `npm run dev`.'
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
