/**
 * GET /api/messages - Get all messages/notifications for current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMessagesByUserId } from '@/lib/supabase/db';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getCurrentUser();

    if (!authUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const unreadOnly = searchParams.get('unread') === 'true';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

    const messages = await getMessagesByUserId(authUser.id, { unreadOnly, limit });

    return NextResponse.json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error('[API] Get messages error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
