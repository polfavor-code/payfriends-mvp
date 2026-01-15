import { NextResponse } from 'next/server';
import { setRemoteConfig } from '@/lib/db-supabase';
import { getAdminId } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const adminId = await getAdminId();
    const { key, value, type, description } = await request.json();

    if (!key || !value) {
      return NextResponse.json({ error: 'Key and value required' }, { status: 400 });
    }

    await setRemoteConfig(key, value, type || 'string', description || '', adminId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
