/**
 * GET /api/friends/[publicId] - Get friend details and agreements
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUserByPublicId, getAgreementsByUserId } from '@/lib/supabase/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const authUser = await getCurrentUser();

    if (!authUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { publicId } = await params;

    // Get friend by public ID
    const friend = await getUserByPublicId(publicId);

    if (!friend) {
      return NextResponse.json(
        { error: 'Friend not found' },
        { status: 404 }
      );
    }

    // Get all agreements and filter to ones involving this friend
    const allAgreements = await getAgreementsByUserId(authUser.id);
    
    const agreements = allAgreements.filter(agreement => {
      const isFriendLender = agreement.lender_user_id === friend.id;
      const isFriendBorrower = agreement.borrower_user_id === friend.id;
      return isFriendLender || isFriendBorrower;
    });

    return NextResponse.json({
      success: true,
      friend: {
        publicId: friend.public_id,
        name: friend.full_name,
        email: friend.email,
      },
      agreements,
    });
  } catch (error) {
    console.error('[API] Get friend error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
