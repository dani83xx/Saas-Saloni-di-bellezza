import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://izbhxyhepzwsgobtihfc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6Ymh4eWhlcHp3c2dvYnRpaGZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxODQ0ODAsImV4cCI6MjEwNTc2MDQ4MH0.QF4nEZAabUR6HX3ep5atb-4sAqv32LyTEZ3E99MUuz8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: false, // <-- questa opzione sblocca il congelamento del client
  },
});
