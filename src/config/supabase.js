import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vtmdateqrrrkqbpeedrx.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0bWRhdGVxcnJya3FicGVlZHJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNjAwMTAsImV4cCI6MjA3NjgzNjAxMH0.5ydzJnACZrldXIMf3LAOJVsmb6BFEers1nJTv_QorrU' ;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});