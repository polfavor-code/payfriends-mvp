/**
 * GET /api/grouptabs/[id]/participants - Get participants for a group tab
 * POST /api/grouptabs/[id]/participants - Add a participant
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getGroupTabById, getParticipantsByTabId, createParticipant } from '@/lib/supabase/db';
import { generateToken } from '@/lib/utils';

export async function GET(
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
    const tabId = parseInt(id);

    if (isNaN(tabId)) {
      return NextResponse.json(
        { error: 'Invalid tab ID' },
        { status: 400 }
      );
    }

    const tab = await getGroupTabById(tabId);

    if (!tab) {
      return NextResponse.json(
        { error: 'Group tab not found' },
        { status: 404 }
      );
    }

    const participants = await getParticipantsByTabId(tabId);

    return NextResponse.json({
      success: true,
      participants,
    });
  } catch (error) {
    console.error('[API] Get participants error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

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
    const tabId = parseInt(id);

    if (isNaN(tabId)) {
      return NextResponse.json(
        { error: 'Invalid tab ID' },
        { status: 400 }
      );
    }

    const tab = await getGroupTabById(tabId);

    if (!tab) {
      return NextResponse.json(
        { error: 'Group tab not found' },
        { status: 404 }
      );
    }

    // Only creator can add participants
    if (tab.creator_user_id !== authUser.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { guestName, amountOwedCents, isOrganizer = false } = body;

    if (!guestName) {
      return NextResponse.json(
        { error: 'Guest name is required' },
        { status: 400 }
      );
    }

    const guestSessionToken = generateToken(16);

    const participant = await createParticipant({
      group_tab_id: tabId,
      user_id: null,
      guest_name: guestName,
      guest_session_token: guestSessionToken,
      role: isOrganizer ? 'host' : 'participant',
      is_member: false,
      hide_name: false,
      seats_claimed: 1,
      tier_name: null,
      tier_multiplier: 1.0,
      tier_id: null,
      price_group_id: null,
      custom_amount_cents: null,
      fair_share_cents: amountOwedCents || null,
      remaining_cents: amountOwedCents || null,
      total_paid_cents: 0,
    });

    return NextResponse.json({
      success: true,
      participant,
    });
  } catch (error) {
    console.error('[API] Add participant error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
