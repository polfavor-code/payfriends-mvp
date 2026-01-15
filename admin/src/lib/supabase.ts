/**
 * Supabase Client for Admin CMS
 * 
 * Uses service role key to bypass RLS for admin operations.
 * This file should only be imported server-side.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.warn('[Supabase] Warning: NEXT_PUBLIC_SUPABASE_URL is not set');
}

if (!supabaseServiceKey) {
  console.warn('[Supabase] Warning: SUPABASE_SERVICE_ROLE_KEY is not set');
}

// Create admin client with service role (bypasses RLS)
let supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin && supabaseUrl && supabaseServiceKey) {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not configured. Check environment variables.');
  }
  
  return supabaseAdmin;
}

export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseServiceKey);
}
