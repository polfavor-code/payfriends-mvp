/**
 * POST /api/security/change-password - Change user password
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, verifyPassword, hashPassword } from '@/lib/auth';
import { getUserById, updateUser } from '@/lib/supabase/db';

export async function POST(request: NextRequest) {
  try {
    const authUser = await getCurrentUser();

    if (!authUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Get user with password hash
    const user = await getUserById(authUser.id);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Hash new password and update
    const newPasswordHash = await hashPassword(newPassword);
    await updateUser(authUser.id, { password_hash: newPasswordHash });

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('[API] Change password error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
