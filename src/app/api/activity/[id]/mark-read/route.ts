/**
 * POST /api/activity/[id]/mark-read - Mark a single message as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { markMessageAsRead } from '@/lib/supabase/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getCurrentUser();

    if (!authUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const messageId = parseInt(id);

    if (isNaN(messageId)) {
      return NextResponse.json(
        { error: 'Invalid message ID' },
        { status: 400 }
      );
    }

    await markMessageAsRead(messageId);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('[API] Mark read error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
