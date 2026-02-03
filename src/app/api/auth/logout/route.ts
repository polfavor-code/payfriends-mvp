/**
 * POST /api/auth/logout
 * Logout the current user
 */

import { NextResponse } from 'next/server';
import { logoutUser } from '@/lib/auth';

export async function POST() {
  try {
    await logoutUser();

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('[API] Logout error:', error);
    return NextResponse.json(
      { error: 'An error occurred during logout' },
      { status: 500 }
    );
  }
}
