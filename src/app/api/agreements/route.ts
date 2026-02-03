/**
 * GET /api/agreements - List all agreements for current user
 * POST /api/agreements - Create a new agreement
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAgreementsByUserId, createAgreement, createInvite } from '@/lib/supabase/db';
import { generateToken } from '@/lib/utils';

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
    const status = searchParams.get('status') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

    const agreements = await getAgreementsByUserId(authUser.id, { status, limit });

    return NextResponse.json({
      success: true,
      agreements,
    });
  } catch (error) {
    console.error('[API] List agreements error:', error);
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
      lenderName,
      borrowerEmail,
      friendFirstName,
      direction = 'lend',
      repaymentType = 'one_time',
      amountCents,
      interestRate,
      installmentCount,
      paymentFrequency,
      dueDate,
      description,
      calcVersion,
    } = body;

    // Validate required fields
    if (!lenderName || !borrowerEmail || !amountCents || !dueDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create the agreement
    const agreement = await createAgreement({
      lender_user_id: authUser.id,
      lender_name: lenderName,
      borrower_user_id: null,
      borrower_email: borrowerEmail.toLowerCase(),
      friend_first_name: friendFirstName || null,
      direction,
      repayment_type: repaymentType,
      amount_cents: amountCents,
      interest_rate: interestRate || null,
      installment_count: installmentCount || null,
      payment_frequency: paymentFrequency || null,
      due_date: dueDate,
      status: 'pending',
      description: description || null,
      has_repayment_issue: false,
      calc_version: calcVersion || null,
    });

    // Create invite token
    const inviteToken = generateToken(32);
    await createInvite({
      agreementId: agreement.id,
      email: borrowerEmail.toLowerCase(),
      token: inviteToken,
    });

    return NextResponse.json({
      success: true,
      agreement: {
        ...agreement,
        inviteToken,
      },
    });
  } catch (error) {
    console.error('[API] Create agreement error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
