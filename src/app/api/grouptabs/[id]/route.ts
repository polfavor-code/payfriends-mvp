/**
 * GET /api/grouptabs/[id] - Get a single group tab
 * PATCH /api/grouptabs/[id] - Update a group tab
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getGroupTabById, updateGroupTab, getParticipantsByTabId, getPaymentReportsByTabId } from '@/lib/supabase/db';

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
    const tabId = parseInt(id);

    if (isNaN(tabId)) {
      return NextResponse.json(
        { error: 'Invalid tab ID' },
        { status: 400 }
      );
    }

    const tab = await getGroupTabById(tabId);

    if (!tab) {
      return NextResponse.json(
        { error: 'Group tab not found' },
        { status: 404 }
      );
    }

    // Check if user is the creator
    if (tab.creator_user_id !== authUser.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get participants and payment reports
    const participants = await getParticipantsByTabId(tabId);
    const paymentReports = await getPaymentReportsByTabId(tabId);

    return NextResponse.json({
      success: true,
      tab,
      participants,
      paymentReports,
    });
  } catch (error) {
    console.error('[API] Get group tab error:', error);
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
    const tabId = parseInt(id);

    if (isNaN(tabId)) {
      return NextResponse.json(
        { error: 'Invalid tab ID' },
        { status: 400 }
      );
    }

    const tab = await getGroupTabById(tabId);

    if (!tab) {
      return NextResponse.json(
        { error: 'Group tab not found' },
        { status: 404 }
      );
    }

    // Only creator can update
    if (tab.creator_user_id !== authUser.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      totalAmountCents,
      splitMode,
      expectedPayRate,
      peopleCount,
      proofRequired,
      status,
    } = body;

    const updates: Record<string, unknown> = {};

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (totalAmountCents !== undefined) updates.total_amount_cents = totalAmountCents;
    if (splitMode !== undefined) updates.split_mode = splitMode;
    if (expectedPayRate !== undefined) updates.expected_pay_rate = expectedPayRate;
    if (peopleCount !== undefined) updates.people_count = peopleCount;
    if (proofRequired !== undefined) updates.proof_required = proofRequired;
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const updatedTab = await updateGroupTab(tabId, updates);

    return NextResponse.json({
      success: true,
      tab: updatedTab,
    });
  } catch (error) {
    console.error('[API] Update group tab error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
