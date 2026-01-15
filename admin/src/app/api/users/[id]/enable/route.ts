import { NextResponse } from 'next/server';
import { enableUser } from '@/lib/db-supabase';
import { getAdminId } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminId = await getAdminId();
    
    await enableUser(id, adminId);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
