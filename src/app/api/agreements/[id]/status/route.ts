/**
 * PATCH /api/agreements/[id]/status - Update agreement status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAgreementById, updateAgreement } from '@/lib/supabase/db';

const VALID_STATUSES = ['pending', 'active', 'settled', 'cancelled'];

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

    const body = await request.json();
    const { status } = body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
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

    const updatedAgreement = await updateAgreement(agreementId, { status });

    return NextResponse.json({
      success: true,
      agreement: updatedAgreement,
    });
  } catch (error) {
    console.error('[API] Update status error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
