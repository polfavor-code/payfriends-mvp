/**
 * POST /api/activity/mark-all-read - Mark all messages as read
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { markAllMessagesAsRead } from '@/lib/supabase/db';

export async function POST() {
  try {
    const authUser = await getCurrentUser();

    if (!authUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    await markAllMessagesAsRead(authUser.id);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('[API] Mark all read error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
