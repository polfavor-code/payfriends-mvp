/**
 * Supabase Client - Browser-side
 * 
 * This module provides a Supabase client for browser/frontend use.
 * It uses the anon key and respects RLS policies.
 * 
 * Usage in HTML:
 * <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 * <script src="/js/supabase-browser.js"></script>
 */

// For browser usage, we create a global supabase client
// The actual keys are injected by the server in the HTML template
(function() {
  'use strict';

  // These will be set by the server when rendering the page
  const SUPABASE_URL = window.SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[Supabase] Browser client not configured. Auth features will not work.');
    window.supabaseClient = null;
    return;
  }

  // Create the Supabase client
  // supabase global comes from the CDN script
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });

    console.log('[Supabase] Browser client initialized');
  } else {
    console.error('[Supabase] Supabase JS library not loaded');
    window.supabaseClient = null;
  }
})();

/**
 * Helper functions for browser auth
 */
window.PayFriendsAuth = {
  /**
   * Sign up with email and password
   */
  async signUp(email, password, metadata = {}) {
    if (!window.supabaseClient) throw new Error('Supabase not configured');
    
    const { data, error } = await window.supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });
    
    if (error) throw error;
    return data;
  },

  /**
   * Sign in with email and password
   */
  async signIn(email, password) {
    if (!window.supabaseClient) throw new Error('Supabase not configured');
    
    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  },

  /**
   * Sign in with magic link (passwordless)
   */
  async signInWithMagicLink(email, redirectTo) {
    if (!window.supabaseClient) throw new Error('Supabase not configured');
    
    const { data, error } = await window.supabaseClient.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo || window.location.origin,
      },
    });
    
    if (error) throw error;
    return data;
  },

  /**
   * Sign out
   */
  async signOut() {
    if (!window.supabaseClient) throw new Error('Supabase not configured');
    
    const { error } = await window.supabaseClient.auth.signOut();
    if (error) throw error;
  },

  /**
   * Get current session
   */
  async getSession() {
    if (!window.supabaseClient) return null;
    
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    return session;
  },

  /**
   * Get current user
   */
  async getUser() {
    if (!window.supabaseClient) return null;
    
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    return user;
  },

  /**
   * Listen for auth state changes
   */
  onAuthStateChange(callback) {
    if (!window.supabaseClient) return { data: { subscription: null } };
    
    return window.supabaseClient.auth.onAuthStateChange(callback);
  },

  /**
   * Reset password
   */
  async resetPassword(email, redirectTo) {
    if (!window.supabaseClient) throw new Error('Supabase not configured');
    
    const { data, error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo || `${window.location.origin}/reset-password`,
    });
    
    if (error) throw error;
    return data;
  },

  /**
   * Update password (when user is logged in)
   */
  async updatePassword(newPassword) {
    if (!window.supabaseClient) throw new Error('Supabase not configured');
    
    const { data, error } = await window.supabaseClient.auth.updateUser({
      password: newPassword,
    });
    
    if (error) throw error;
    return data;
  },
};
