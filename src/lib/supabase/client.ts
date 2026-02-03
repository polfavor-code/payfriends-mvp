/**
 * Supabase Client - Server-side
 * 
 * This module provides Supabase client instances for server-side use.
 * Use the appropriate client based on your needs:
 * - createServerClient: Uses service role key, bypasses RLS (for API routes)
 * - createBrowserClient: Uses anon key, respects RLS (for client-side)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createServerClient as createSSRServerClient, createBrowserClient as createSSRBrowserClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Check if Supabase is properly configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

/**
 * Check if admin client is available
 */
export function isAdminConfigured(): boolean {
  return !!(supabaseUrl && supabaseServiceKey);
}

/**
 * Admin Supabase client - bypasses RLS
 * Use this ONLY for admin operations that need to see/modify all data
 * NEVER expose this client to the browser
 */
let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient && supabaseUrl && supabaseServiceKey) {
    adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  
  if (!adminClient) {
    throw new Error('Supabase admin client not configured. Check environment variables.');
  }
  
  return adminClient;
}

/**
 * Create a Supabase client for server components
 * This uses cookies for session management
 */
export async function createServerClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing');
  }

  const cookieStore = await cookies();

  return createSSRServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Ignore errors in server components
        }
      },
    },
  });
}

/**
 * Create a Supabase client for browser/client components
 */
export function createBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing');
  }

  return createSSRBrowserClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Standard Supabase client - respects RLS (for server-side without cookies)
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
    },
  });
}
