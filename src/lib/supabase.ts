
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://izbhxyhepzwsgobtihfc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6Ymh4eWhlcHp3c2dvYnRpaGZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxODQ0ODAsImV4cCI6MjEwNTc2MDQ4MH0.QF4nEZAabUR6HX3ep5atb-4sAqv32LyTEZ3E99MUuz8';

/** Redirect OAuth e recupero password: stesso origine di localhost o del deploy. */
export function getAuthRedirectUrl(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: async (_name, _timeout, fn) => fn(),
  },
});


