/**
 * POST /api/agreements/[id]/accept - Borrower accepts the agreement
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAgreementById, updateAgreement } from '@/lib/supabase/db';

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

    // Only the borrower can accept
    if (agreement.borrower_user_id !== authUser.id) {
      return NextResponse.json(
        { error: 'Only the borrower can accept this agreement' },
        { status: 403 }
      );
    }

    // Can only accept pending agreements
    if (agreement.status !== 'pending') {
      return NextResponse.json(
        { error: 'Agreement is not pending' },
        { status: 400 }
      );
    }

    const updatedAgreement = await updateAgreement(agreementId, { status: 'active' });

    return NextResponse.json({
      success: true,
      agreement: updatedAgreement,
    });
  } catch (error) {
    console.error('[API] Accept agreement error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
