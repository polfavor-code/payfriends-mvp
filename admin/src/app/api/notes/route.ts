import { NextResponse } from 'next/server';
import { addAdminNote } from '@/lib/db-supabase';
import { getAdminId } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const adminId = await getAdminId();
    const { entityType, entityId, note } = await request.json();
    
    if (!entityType || !entityId || !note) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    await addAdminNote(entityType, entityId, note, adminId);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
