/**
 * POST /api/profile/picture - Upload profile picture
 * DELETE /api/profile/picture - Remove profile picture
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { updateUser } from '@/lib/supabase/db';
import { getSupabaseAdmin } from '@/lib/supabase/client';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    const authUser = await getCurrentUser();

    if (!authUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('picture') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Generate file path
    const ext = file.type.split('/')[1];
    const filePath = `profile-pictures/${authUser.id}.${ext}`;

    // Upload to Supabase Storage
    const supabase = getSupabaseAdmin();
    const buffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('[API] Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload picture' },
        { status: 500 }
      );
    }

    // Update user record
    await updateUser(authUser.id, { profile_picture: filePath });

    return NextResponse.json({
      success: true,
      profilePictureUrl: `/api/profile/picture/${authUser.id}`,
    });
  } catch (error) {
    console.error('[API] Profile picture upload error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const authUser = await getCurrentUser();

    if (!authUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Clear the profile picture path
    await updateUser(authUser.id, { profile_picture: null });

    // Optionally delete from storage (keeping file for now in case of reuse)

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('[API] Profile picture delete error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
