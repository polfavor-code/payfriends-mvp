/**
 * Authentication utilities
 * Handles session-based authentication for PayFriends
 */

import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getUserById, getUserByEmail, getSessionById, createSession, deleteSession, createUser, type User } from './supabase/db';

const SESSION_COOKIE_NAME = 'pf_session';
const SESSION_EXPIRY_DAYS = 30;
const SALT_ROUNDS = 10;

export interface AuthUser {
  id: number;
  email: string;
  fullName: string | null;
  publicId: string | null;
  isAdmin: boolean;
  profilePicturePath: string | null;
}

/**
 * Get the current authenticated user from the session cookie
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    
    if (!sessionId) {
      return null;
    }
    
    const session = await getSessionById(sessionId);
    
    if (!session) {
      return null;
    }
    
    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      await deleteSession(sessionId);
      return null;
    }
    
    const user = await getUserById(session.user_id);
    
    if (!user) {
      return null;
    }
    
    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      publicId: user.public_id,
      isAdmin: user.is_admin,
      profilePicturePath: user.profile_picture,
    };
  } catch (error) {
    console.error('[Auth] getCurrentUser error:', error);
    return null;
  }
}

/**
 * Validate session without getting the full user
 */
export async function validateSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  
  if (!sessionId) {
    return false;
  }
  
  const session = await getSessionById(sessionId);
  
  if (!session || new Date(session.expires_at) < new Date()) {
    return false;
  }
  
  return true;
}

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a secure session ID
 */
export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a public ID for a user
 */
export function generatePublicId(): string {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Create a new session for a user
 */
export async function createUserSession(userId: number): Promise<string> {
  const sessionId = generateSessionId();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);
  
  await createSession({
    id: sessionId,
    userId,
    expiresAt: expiresAt.toISOString(),
  });
  
  return sessionId;
}

/**
 * Set the session cookie
 */
export async function setSessionCookie(sessionId: string): Promise<void> {
  const cookieStore = await cookies();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);
  
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });
}

/**
 * Clear the session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Login a user with email and password
 */
export async function loginUser(email: string, password: string): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  try {
    const user = await getUserByEmail(email);
    
    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }
    
    const passwordValid = await verifyPassword(password, user.password_hash);
    
    if (!passwordValid) {
      return { success: false, error: 'Invalid email or password' };
    }
    
    const sessionId = await createUserSession(user.id);
    await setSessionCookie(sessionId);
    
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        publicId: user.public_id,
        isAdmin: user.is_admin,
        profilePicturePath: user.profile_picture,
      },
    };
  } catch (error) {
    console.error('[Auth] loginUser error:', error);
    return { success: false, error: 'An error occurred during login' };
  }
}

/**
 * Sign up a new user
 */
export async function signupUser(
  email: string,
  password: string,
  fullName?: string
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  try {
    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    
    if (existingUser) {
      return { success: false, error: 'An account with this email already exists' };
    }
    
    // Validate password
    if (password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters' };
    }
    
    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const publicId = generatePublicId();
    
    const user = await createUser({
      email,
      passwordHash,
      fullName,
      publicId,
    });
    
    // Create session and set cookie
    const sessionId = await createUserSession(user.id);
    await setSessionCookie(sessionId);
    
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        publicId: user.public_id,
        isAdmin: user.is_admin,
        profilePicturePath: user.profile_picture,
      },
    };
  } catch (error) {
    console.error('[Auth] signupUser error:', error);
    return { success: false, error: 'An error occurred during signup' };
  }
}

/**
 * Logout the current user
 */
export async function logoutUser(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    
    if (sessionId) {
      await deleteSession(sessionId);
    }
    
    await clearSessionCookie();
  } catch (error) {
    console.error('[Auth] logoutUser error:', error);
  }
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  return user;
}

/**
 * Require admin - throws if not admin
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  if (!user.isAdmin) {
    throw new Error('Forbidden');
  }
  
  return user;
}
