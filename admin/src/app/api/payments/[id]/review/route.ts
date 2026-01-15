import { NextResponse } from 'next/server';
import { markPaymentReportReviewed } from '@/lib/db-supabase';
import { getAdminId } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminId = await getAdminId();
    
    await markPaymentReportReviewed(id, adminId);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
