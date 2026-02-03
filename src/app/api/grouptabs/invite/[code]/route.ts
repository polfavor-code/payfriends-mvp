/**
 * GET /api/grouptabs/invite/[code] - Get group tab by invite code (public)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { getParticipantsByTabId } from '@/lib/supabase/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const supabase = getSupabaseAdmin();
    const inviteCode = params.code;

    // Fetch the tab by invite code
    const { data: tab, error: tabError } = await supabase
      .from('group_tabs')
      .select(`
        *,
        creator:users!creator_user_id(id, full_name)
      `)
      .eq('invite_code', inviteCode)
      .single();

    if (tabError || !tab) {
      return NextResponse.json(
        { error: 'Tab not found' },
        { status: 404 }
      );
    }

    // Fetch participants using the db helper
    const participants = await getParticipantsByTabId(tab.id);

    // Add creator name to tab
    const tabWithCreator = {
      ...tab,
      creator_name: tab.creator?.full_name || null,
    };

    return NextResponse.json({
      success: true,
      tab: tabWithCreator,
      participants,
    });
  } catch (error) {
    console.error('[API] Get tab by invite code error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
