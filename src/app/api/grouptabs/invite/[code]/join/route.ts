/**
 * POST /api/grouptabs/invite/[code]/join - Join a group tab as a guest
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/client';
import { generateToken } from '@/lib/utils';

export async function POST(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const supabase = getSupabaseAdmin();
    const inviteCode = params.code;
    const body = await request.json();
    const { name, isPrivate } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Fetch the tab by invite code
    const { data: tab, error: tabError } = await supabase
      .from('group_tabs')
      .select('id, people_count, total_amount_cents, split_mode')
      .eq('invite_code', inviteCode)
      .single();

    if (tabError || !tab) {
      return NextResponse.json(
        { error: 'Tab not found' },
        { status: 404 }
      );
    }

    // Check if tab is full
    const { count } = await supabase
      .from('group_tab_participants')
      .select('*', { count: 'exact', head: true })
      .eq('group_tab_id', tab.id);

    if (count !== null && count >= tab.people_count) {
      return NextResponse.json(
        { error: 'This tab is full' },
        { status: 400 }
      );
    }

    // Calculate amount owed
    let amountOwed = null;
    if (tab.total_amount_cents && tab.people_count) {
      amountOwed = Math.round(tab.total_amount_cents / tab.people_count);
    }

    // Generate session token for guest
    const sessionToken = generateToken(32);

    // Create participant
    const { data: participant, error: participantError } = await supabase
      .from('group_tab_participants')
      .insert({
        group_tab_id: tab.id,
        guest_name: name.trim(),
        guest_session_token: sessionToken,
        fair_share_cents: amountOwed,
        remaining_cents: amountOwed,
        total_paid_cents: 0,
        role: 'participant',
        joined_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (participantError) {
      console.error('[API] Join tab error:', participantError);
      return NextResponse.json(
        { error: 'Failed to join tab' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      participant,
      sessionToken,
    });
  } catch (error) {
    console.error('[API] Join tab error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
