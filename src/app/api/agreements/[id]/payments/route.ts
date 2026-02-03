/**
 * GET /api/agreements/[id]/payments - Get payments for an agreement
 * POST /api/agreements/[id]/payments - Record a new payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAgreementById, getPaymentsByAgreementId, createPayment } from '@/lib/supabase/db';

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
    const agreementId = parseInt(id);

    if (isNaN(agreementId)) {
      return NextResponse.json(
        { error: 'Invalid agreement ID' },
        { status: 400 }
      );
    }

    const agreement = await getAgreementById(agreementId);

    if (!agreement) {
      return NextResponse.json(
        { error: 'Agreement not found' },
        { status: 404 }
      );
    }

    // Check if user has access
    if (agreement.lender_user_id !== authUser.id && agreement.borrower_user_id !== authUser.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const payments = await getPaymentsByAgreementId(agreementId);

    return NextResponse.json({
      success: true,
      payments,
    });
  } catch (error) {
    console.error('[API] Get payments error:', error);
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
    const agreementId = parseInt(id);

    if (isNaN(agreementId)) {
      return NextResponse.json(
        { error: 'Invalid agreement ID' },
        { status: 400 }
      );
    }

    const agreement = await getAgreementById(agreementId);

    if (!agreement) {
      return NextResponse.json(
        { error: 'Agreement not found' },
        { status: 404 }
      );
    }

    // Check if user has access
    if (agreement.lender_user_id !== authUser.id && agreement.borrower_user_id !== authUser.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Can only add payments to active agreements
    if (agreement.status !== 'active') {
      return NextResponse.json(
        { error: 'Can only record payments for active agreements' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { amountCents, method, note } = body;

    if (!amountCents || amountCents <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    const payment = await createPayment({
      agreement_id: agreementId,
      recorded_by_user_id: authUser.id,
      amount_cents: amountCents,
      method: method || null,
      note: note || null,
      status: 'approved',
      proof_file_path: null,
    });

    return NextResponse.json({
      success: true,
      payment,
    });
  } catch (error) {
    console.error('[API] Create payment error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
