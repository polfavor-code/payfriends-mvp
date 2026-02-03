/**
 * GET /api/profile - Get current user profile
 * POST /api/profile - Update current user profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUserById, updateUser } from '@/lib/supabase/db';

export async function GET() {
  try {
    const authUser = await getCurrentUser();

    if (!authUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = await getUserById(authUser.id);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        publicId: user.public_id,
        phoneNumber: user.phone_number,
        timezone: user.timezone,
        profilePicturePath: user.profile_picture,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('[API] Get profile error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

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
    const { fullName, phoneNumber, timezone } = body;

    // Build update object (only include fields that were provided)
    const updates: Record<string, string | null> = {};
    
    if (fullName !== undefined) {
      updates.full_name = fullName || null;
    }
    
    if (phoneNumber !== undefined) {
      updates.phone_number = phoneNumber || null;
    }
    
    if (timezone !== undefined) {
      updates.timezone = timezone || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const user = await updateUser(authUser.id, updates);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        publicId: user.public_id,
        phoneNumber: user.phone_number,
        timezone: user.timezone,
        profilePicturePath: user.profile_picture,
      },
    });
  } catch (error) {
    console.error('[API] Update profile error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
