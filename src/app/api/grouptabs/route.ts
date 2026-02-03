/**
 * GET /api/grouptabs - List all group tabs for current user
 * POST /api/grouptabs - Create a new group tab
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getGroupTabsByUserId, createGroupTab } from '@/lib/supabase/db';
import { generateToken } from '@/lib/utils';

export async function GET() {
  try {
    const authUser = await getCurrentUser();

    if (!authUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const tabs = await getGroupTabsByUserId(authUser.id);

    return NextResponse.json({
      success: true,
      tabs,
    });
  } catch (error) {
    console.error('[API] List group tabs error:', error);
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
    const {
      name,
      description,
      tabType = 'one_bill',
      template,
      totalAmountCents,
      splitMode = 'equal',
      expectedPayRate = 100,
      seatCount,
      peopleCount = 2,
      proofRequired = 'optional',
      // Gift-specific fields
      giftMode,
      recipientName,
      aboutText,
      aboutLink,
      amountTarget,
      contributorCount,
      isOpenPot,
      // Payment methods
      paymentMethods,
    } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Generate tokens
    const magicToken = generateToken(16);
    const ownerToken = generateToken(16);
    // Generate invite code (12 chars, URL-safe)
    const inviteCode = generateToken(12);
    const manageCode = generateToken(12);

    const tab = await createGroupTab({
      creator_user_id: authUser.id,
      name,
      description: description || null,
      tab_type: tabType,
      template: template || null,
      status: 'open',
      total_amount_cents: totalAmountCents || null,
      split_mode: splitMode,
      expected_pay_rate: expectedPayRate,
      seat_count: seatCount || null,
      people_count: peopleCount,
      receipt_file_path: null,
      paid_up_cents: 0,
      host_overpaid_cents: 0,
      total_raised_cents: 0,
      proof_required: proofRequired,
      magic_token: magicToken,
      owner_token: ownerToken,
      invite_code: inviteCode,
      manage_code: manageCode,
      event_date: null,
      // Gift-specific fields
      gift_mode: giftMode || null,
      group_gift_mode: 'gift',
      recipient_name: recipientName || null,
      about_text: aboutText || null,
      about_image_path: null,
      about_link: aboutLink || null,
      is_raising_money_only: false,
      amount_target: amountTarget || null,
      contributor_count: contributorCount || null,
      raising_for_text: null,
      raising_for_image_path: null,
      raising_for_link: null,
      is_open_pot: isOpenPot || false,
      organizer_contribution: null,
      closed_at: null,
      // Payment methods as JSON string
      payment_methods_json: paymentMethods ? JSON.stringify(paymentMethods) : null,
    });

    return NextResponse.json({
      success: true,
      tab,
    });
  } catch (error: unknown) {
    console.error('[API] Create group tab error:', error);
    let errorMessage = 'Unknown error';
    let errorDetails = '';
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack || '';
    } else if (typeof error === 'object' && error !== null) {
      errorMessage = JSON.stringify(error);
    }
    return NextResponse.json(
      { error: 'An error occurred', details: errorMessage, stack: errorDetails },
      { status: 500 }
    );
  }
}
