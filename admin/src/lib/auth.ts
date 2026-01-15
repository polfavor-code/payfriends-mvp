/**
 * Admin Authentication Layer
 * Simple session-based authentication for the admin CMS
 */
import { cookies } from 'next/headers';

// In production, this should be stored securely and rotated
const ADMIN_SESSION_COOKIE = 'admin_session';

// Hardcoded admin credentials for MVP (in production, use a proper auth system)
const ADMIN_CREDENTIALS = {
  username: 'admin',
  // Password: 'payfriends-admin-2024' - bcrypt hash
  passwordHash: '$2b$10$rqJQF4HKK3VzNQK8QgJnWOvNQwBT3lLDJ8V8P3QwNQK8QgJnWOvN',
};

export interface AdminSession {
  adminId: string;
  username: string;
  createdAt: number;
}

/**
 * Check if the current request has a valid admin session
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_SESSION_COOKIE);
  
  if (!sessionCookie?.value) {
    return null;
  }
  
  try {
    const session = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());
    
    // Check if session is still valid (24 hour expiry)
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (Date.now() - session.createdAt > ONE_DAY) {
      return null;
    }
    
    return session as AdminSession;
  } catch {
    return null;
  }
}

/**
 * Create an admin session
 */
export async function createAdminSession(username: string): Promise<string> {
  const session: AdminSession = {
    adminId: `admin_${Date.now()}`,
    username,
    createdAt: Date.now(),
  };
  
  return Buffer.from(JSON.stringify(session)).toString('base64');
}

/**
 * Get the current admin ID for audit logging
 */
export async function getAdminId(): Promise<string> {
  const session = await getAdminSession();
  return session?.adminId || 'system';
}

/**
 * Require admin authentication - redirect to login if not authenticated
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }
  
  return session;
}
