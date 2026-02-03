/**
 * POST /api/grouptabs/invite/[code]/report - Report a payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/client';

export async function POST(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const supabase = getSupabaseAdmin();
    const inviteCode = params.code;
    const body = await request.json();
    const { amountCents, sessionToken } = body;

    if (!amountCents || amountCents <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Session token required' },
        { status: 401 }
      );
    }

    // Fetch the tab by invite code
    const { data: tab, error: tabError } = await supabase
      .from('group_tabs')
      .select('id')
      .eq('invite_code', inviteCode)
      .single();

    if (tabError || !tab) {
      return NextResponse.json(
        { error: 'Tab not found' },
        { status: 404 }
      );
    }

    // Find participant by session token
    const { data: participant, error: participantError } = await supabase
      .from('group_tab_participants')
      .select('id, total_paid_cents, remaining_cents')
      .eq('group_tab_id', tab.id)
      .eq('guest_session_token', sessionToken)
      .single();

    if (participantError || !participant) {
      return NextResponse.json(
        { error: 'Participant not found' },
        { status: 404 }
      );
    }

    // Update participant's paid amount
    const newPaidAmount = (participant.total_paid_cents || 0) + amountCents;
    const newRemaining = Math.max(0, (participant.remaining_cents || 0) - amountCents);

    const { error: updateError } = await supabase
      .from('group_tab_participants')
      .update({ 
        total_paid_cents: newPaidAmount,
        remaining_cents: newRemaining,
      })
      .eq('id', participant.id);

    if (updateError) {
      console.error('[API] Report payment error:', updateError);
      return NextResponse.json(
        { error: 'Failed to report payment' },
        { status: 500 }
      );
    }

    // Update tab's paid_up_cents
    const { data: tabData } = await supabase
      .from('group_tabs')
      .select('paid_up_cents')
      .eq('id', tab.id)
      .single();

    if (tabData) {
      await supabase
        .from('group_tabs')
        .update({ 
          paid_up_cents: (tabData.paid_up_cents || 0) + amountCents,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tab.id);
    }

    return NextResponse.json({
      success: true,
      newPaidAmount,
    });
  } catch (error) {
    console.error('[API] Report payment error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
