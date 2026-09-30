import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://izbhxyhepzwsgobtihfc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6Ymh4eWhlcHp3c2dvYnRpaGZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxODQ0ODAsImV4cCI6MjEwNTc2MDQ4MH0.QF4nEZAabUR6HX3ep5atb-4sAqv32LyTEZ3E99MUuz8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    // Disabilita i lock asincroni (navigator.locks) che causano il freeze all'interno di iframe e anteprime sandbox
    lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
      return await fn();
    },
  },
});
