/**
 * GET /api/profile/picture/[userId] - Get profile picture for a user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserById } from '@/lib/supabase/db';
import { getSupabaseAdmin } from '@/lib/supabase/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = parseInt(params.userId, 10);

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    const user = await getUserById(userId);

    if (!user || !user.profile_picture) {
      // Return 404 if no profile picture
      return NextResponse.json(
        { error: 'Profile picture not found' },
        { status: 404 }
      );
    }

    // Download from Supabase Storage
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from('uploads')
      .download(user.profile_picture);

    if (error || !data) {
      console.error('[API] Download error:', error);
      return NextResponse.json(
        { error: 'Profile picture not found' },
        { status: 404 }
      );
    }

    // Determine content type from path
    const ext = user.profile_picture.split('.').pop()?.toLowerCase();
    let contentType = 'image/jpeg';
    if (ext === 'png') contentType = 'image/png';
    else if (ext === 'webp') contentType = 'image/webp';

    // Return the image
    const buffer = await data.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[API] Profile picture get error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
