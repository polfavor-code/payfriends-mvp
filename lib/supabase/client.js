/**
 * Supabase Client - Server-side
 * 
 * This module provides Supabase client instances for server-side use.
 * Use the appropriate client based on your needs:
 * - supabase: Uses anon key, respects RLS (for user-context operations)
 * - supabaseAdmin: Uses service role key, bypasses RLS (for admin operations)
 */

const { createClient } = require('@supabase/supabase-js');

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.warn('[Supabase] Warning: NEXT_PUBLIC_SUPABASE_URL is not set');
}

if (!supabaseAnonKey) {
  console.warn('[Supabase] Warning: NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
}

/**
 * Standard Supabase client - respects RLS
 * Use this for operations that should respect row-level security
 */
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false, // Server-side, no session persistence
      },
    })
  : null;

/**
 * Admin Supabase client - bypasses RLS
 * Use this ONLY for admin operations that need to see/modify all data
 * NEVER expose this client to the browser
 */
const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

/**
 * Create a Supabase client with a specific user's JWT
 * Use this when you have a user's access token and want to make requests as them
 * 
 * @param {string} accessToken - The user's JWT access token
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function createUserClient(accessToken) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing');
  }
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Check if Supabase is properly configured
 * @returns {boolean}
 */
function isSupabaseConfigured() {
  return !!(supabaseUrl && supabaseAnonKey);
}

/**
 * Check if admin client is available
 * @returns {boolean}
 */
function isAdminConfigured() {
  return !!(supabaseUrl && supabaseServiceKey);
}

module.exports = {
  supabase,
  supabaseAdmin,
  createUserClient,
  isSupabaseConfigured,
  isAdminConfigured,
};
