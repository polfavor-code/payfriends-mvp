/**
 * GET /api/friends - Get list of friends (aggregated from agreements)
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAgreementsByUserId } from '@/lib/supabase/db';

interface FriendSummary {
  publicId: string | null;
  name: string;
  email: string;
  totalLoans: number;
  totalBorrowed: number;
  activeCount: number;
  pendingCount: number;
  settledCount: number;
}

export async function GET() {
  try {
    const authUser = await getCurrentUser();

    if (!authUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const agreements = await getAgreementsByUserId(authUser.id);

    // Build friends map from agreements
    const friendsMap = new Map<string, FriendSummary>();

    for (const agreement of agreements) {
      // Determine the friend (the other party in the agreement)
      let friendEmail: string;
      let friendName: string;
      let friendPublicId: string | null = null;
      let isLending: boolean;

      if (agreement.lender_user_id === authUser.id) {
        // Current user is the lender, friend is borrower
        friendEmail = agreement.borrower_email;
        friendName = agreement.borrower?.full_name || agreement.friend_first_name || friendEmail;
        friendPublicId = (agreement.borrower as { public_id?: string })?.public_id || null;
        isLending = true;
      } else {
        // Current user is the borrower, friend is lender
        friendEmail = agreement.lender?.email || '';
        friendName = agreement.lender?.full_name || agreement.lender_name;
        friendPublicId = (agreement.lender as { public_id?: string })?.public_id || null;
        isLending = false;
      }

      const key = friendEmail.toLowerCase();
      
      if (!friendsMap.has(key)) {
        friendsMap.set(key, {
          publicId: friendPublicId,
          name: friendName,
          email: friendEmail,
          totalLoans: 0,
          totalBorrowed: 0,
          activeCount: 0,
          pendingCount: 0,
          settledCount: 0,
        });
      }

      const friend = friendsMap.get(key)!;

      // Update totals
      if (isLending) {
        friend.totalLoans += agreement.amount_cents;
      } else {
        friend.totalBorrowed += agreement.amount_cents;
      }

      // Update counts
      switch (agreement.status) {
        case 'active':
          friend.activeCount++;
          break;
        case 'pending':
          friend.pendingCount++;
          break;
        case 'settled':
          friend.settledCount++;
          break;
      }

      // Update public ID if we have it now
      if (friendPublicId) {
        friend.publicId = friendPublicId;
      }
    }

    const friends = Array.from(friendsMap.values());

    return NextResponse.json({
      success: true,
      friends,
    });
  } catch (error) {
    console.error('[API] Get friends error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
