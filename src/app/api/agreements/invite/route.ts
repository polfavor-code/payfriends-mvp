/**
 * GET /api/agreements/invite?token=xxx - Get invite details by token
 * POST /api/agreements/invite - Accept an invite (link borrower to agreement)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getInviteByToken, acceptInvite, updateAgreement, getAgreementById } from '@/lib/supabase/db';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const invite = await getInviteByToken(token);

    if (!invite) {
      return NextResponse.json(
        { error: 'Invalid or expired invite' },
        { status: 404 }
      );
    }

    // Don't return sensitive data
    return NextResponse.json({
      success: true,
      invite: {
        id: invite.id,
        email: invite.email,
        accepted: !!invite.accepted_at,
        agreement: invite.agreement ? {
          id: invite.agreement.id,
          lenderName: invite.agreement.lender_name,
          amountCents: invite.agreement.amount_cents,
          dueDate: invite.agreement.due_date,
          status: invite.agreement.status,
          repaymentType: invite.agreement.repayment_type,
          interestRate: invite.agreement.interest_rate,
          installmentCount: invite.agreement.installment_count,
          paymentFrequency: invite.agreement.payment_frequency,
          description: invite.agreement.description,
        } : null,
      },
    });
  } catch (error) {
    console.error('[API] Get invite error:', error);
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
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const invite = await getInviteByToken(token);

    if (!invite) {
      return NextResponse.json(
        { error: 'Invalid or expired invite' },
        { status: 404 }
      );
    }

    // Check if invite matches user's email
    if (invite.email.toLowerCase() !== authUser.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invite is for a different email address' },
        { status: 403 }
      );
    }

    // Check if already accepted
    if (invite.accepted_at) {
      return NextResponse.json(
        { error: 'This invite has already been accepted' },
        { status: 400 }
      );
    }

    // Accept invite and link borrower to agreement
    await acceptInvite(token);
    await updateAgreement(invite.agreement_id, {
      borrower_user_id: authUser.id,
    });

    const agreement = await getAgreementById(invite.agreement_id);

    return NextResponse.json({
      success: true,
      agreement,
    });
  } catch (error) {
    console.error('[API] Accept invite error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
