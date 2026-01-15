/**
 * Supabase Auth Helpers for Express
 * 
 * Provides middleware and utilities for authentication in the Express server.
 */

const { supabaseAdmin, createUserClient } = require('./client');

/**
 * Extract and verify Supabase JWT from request
 * Supports both cookie-based and header-based auth
 * 
 * @param {import('express').Request} req 
 * @returns {Promise<{user: object|null, session: object|null}>}
 */
async function getAuthFromRequest(req) {
  // Try to get token from Authorization header
  let token = null;
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  
  // Try to get token from cookie
  if (!token && req.cookies && req.cookies['sb-access-token']) {
    token = req.cookies['sb-access-token'];
  }
  
  if (!token) {
    return { user: null, session: null };
  }
  
  try {
    // Verify the token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      return { user: null, session: null };
    }
    
    // Get the full user profile from public.users
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('auth_id', user.id)
      .single();
    
    return {
      user: {
        ...user,
        profile, // Include the public profile
        id: profile?.id, // Use the public user ID for backwards compatibility
      },
      session: { access_token: token },
    };
  } catch (err) {
    console.error('[Auth] Error verifying token:', err);
    return { user: null, session: null };
  }
}

/**
 * Express middleware to attach user to request
 * 
 * Usage:
 *   app.use(authMiddleware);
 *   // or for specific routes:
 *   app.get('/api/profile', authMiddleware, (req, res) => { ... });
 */
async function authMiddleware(req, res, next) {
  try {
    const { user, session } = await getAuthFromRequest(req);
    req.user = user;
    req.session = session;
  } catch (err) {
    console.error('[Auth] Middleware error:', err);
    req.user = null;
    req.session = null;
  }
  next();
}

/**
 * Middleware that requires authentication
 * Returns 401 if user is not authenticated
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

/**
 * Middleware that requires admin role
 * Returns 403 if user is not an admin
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const isAdmin = req.user.profile?.is_admin || 
                  isAdminEmail(req.user.email);
  
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
}

/**
 * Check if email is in admin allowlist
 */
function isAdminEmail(email) {
  const adminEmails = (process.env.PAYFRIENDS_ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  
  return adminEmails.includes(email?.toLowerCase());
}

/**
 * Sign in with email and password
 */
async function signInWithPassword(email, password) {
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    throw error;
  }
  
  return data;
}

/**
 * Sign in with magic link (passwordless)
 */
async function signInWithMagicLink(email, redirectTo) {
  const { data, error } = await supabaseAdmin.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
    },
  });
  
  if (error) {
    throw error;
  }
  
  return data;
}

/**
 * Sign up a new user
 */
async function signUp(email, password, metadata = {}) {
  // Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });
  
  if (authError) {
    throw authError;
  }
  
  // Create profile in public.users
  if (authData.user) {
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        auth_id: authData.user.id,
        email: email.toLowerCase(),
        full_name: metadata.full_name || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    
    if (profileError) {
      console.error('[Auth] Failed to create profile:', profileError);
      // Don't throw - auth user was created successfully
    }
  }
  
  return authData;
}

/**
 * Sign out
 */
async function signOut(accessToken) {
  const client = createUserClient(accessToken);
  const { error } = await client.auth.signOut();
  
  if (error) {
    throw error;
  }
}

/**
 * Reset password
 */
async function resetPassword(email, redirectTo) {
  const { data, error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  
  if (error) {
    throw error;
  }
  
  return data;
}

/**
 * Update user password
 */
async function updatePassword(accessToken, newPassword) {
  const client = createUserClient(accessToken);
  const { data, error } = await client.auth.updateUser({
    password: newPassword,
  });
  
  if (error) {
    throw error;
  }
  
  return data;
}

module.exports = {
  getAuthFromRequest,
  authMiddleware,
  requireAuth,
  requireAdmin,
  isAdminEmail,
  signInWithPassword,
  signInWithMagicLink,
  signUp,
  signOut,
  resetPassword,
  updatePassword,
};
