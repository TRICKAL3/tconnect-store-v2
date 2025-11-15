import { createClient } from '@supabase/supabase-js';

// Prefer environment variables; fallback to provided values if not set
const SUPABASE_URL = (process.env.REACT_APP_SUPABASE_URL as string) || 'https://cifqhaamcfqahrpurxpl.supabase.co';
const SUPABASE_ANON_KEY = (process.env.REACT_APP_SUPABASE_ANON_KEY as string) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpZnFoYWFtY2ZxYWhycHVyeHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDgxMDAsImV4cCI6MjA3NzQyNDEwMH0.OMxGVwvfbPFAyqXZNhCrZxkyMyD4gq5AusbWGXeQkRQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


