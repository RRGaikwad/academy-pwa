import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

const PLACEHOLDER_MARKERS = ['your_supabase', 'xxxxxxxx'];

export const isSupabaseConfigured = (): boolean => {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  const combined = `${supabaseUrl} ${supabaseAnonKey}`.toLowerCase();
  return !PLACEHOLDER_MARKERS.some((marker) => combined.includes(marker));
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
