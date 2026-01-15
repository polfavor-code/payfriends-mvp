import { NextResponse } from 'next/server';
import { deleteUser } from '@/lib/db-supabase';
import { getAdminId } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminId = await getAdminId();
    
    const result = await deleteUser(id, adminId, true); // Always anonymize if has history
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
