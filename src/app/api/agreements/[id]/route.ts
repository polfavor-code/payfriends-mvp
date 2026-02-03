/**
 * GET /api/agreements/[id] - Get a single agreement
 * PATCH /api/agreements/[id] - Update an agreement
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAgreementById, updateAgreement, getPaymentsByAgreementId } from '@/lib/supabase/db';

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

    // Check if user has access to this agreement
    if (agreement.lender_user_id !== authUser.id && agreement.borrower_user_id !== authUser.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get payments for this agreement
    const payments = await getPaymentsByAgreementId(agreementId);

    return NextResponse.json({
      success: true,
      agreement,
      payments,
    });
  } catch (error) {
    console.error('[API] Get agreement error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    // Check if user has access to this agreement
    if (agreement.lender_user_id !== authUser.id && agreement.borrower_user_id !== authUser.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { description, hasRepaymentIssue } = body;

    const updates: Record<string, unknown> = {};
    
    if (description !== undefined) {
      updates.description = description;
    }
    
    if (hasRepaymentIssue !== undefined) {
      updates.has_repayment_issue = hasRepaymentIssue;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const updatedAgreement = await updateAgreement(agreementId, updates);

    return NextResponse.json({
      success: true,
      agreement: updatedAgreement,
    });
  } catch (error) {
    console.error('[API] Update agreement error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
