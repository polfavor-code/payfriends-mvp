/**
 * PATCH /api/settings/timezone
 * Update user timezone
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { updateUser } from '@/lib/supabase/db';

export async function PATCH(request: NextRequest) {
  try {
    const authUser = await getCurrentUser();

    if (!authUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { timezone } = body;

    if (!timezone) {
      return NextResponse.json(
        { error: 'Timezone is required' },
        { status: 400 }
      );
    }

    await updateUser(authUser.id, { timezone });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('[API] Update timezone error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
