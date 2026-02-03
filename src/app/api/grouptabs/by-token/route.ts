/**
 * GET /api/grouptabs/by-token?token=xxx - Get group tab by magic token (for guests)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGroupTabByMagicToken, getParticipantsByTabId } from '@/lib/supabase/db';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const tab = await getGroupTabByMagicToken(token);

    if (!tab) {
      return NextResponse.json(
        { error: 'Invalid or expired link' },
        { status: 404 }
      );
    }

    const participants = await getParticipantsByTabId(tab.id);

    // Return limited info for guests
    return NextResponse.json({
      success: true,
      tab: {
        id: tab.id,
        name: tab.name,
        description: tab.description,
        tabType: tab.tab_type,
        status: tab.status,
        totalAmountCents: tab.total_amount_cents,
        splitMode: tab.split_mode,
        peopleCount: tab.people_count,
        proofRequired: tab.proof_required,
      },
      participants: participants.map(p => ({
        id: p.id,
        guestName: p.guest_name,
        fairShareCents: p.fair_share_cents,
        totalPaidCents: p.total_paid_cents,
        role: p.role,
      })),
    });
  } catch (error) {
    console.error('[API] Get tab by token error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
