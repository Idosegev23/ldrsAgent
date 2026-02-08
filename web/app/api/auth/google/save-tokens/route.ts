/**
 * Save Google OAuth Tokens API
 * Called after Supabase auth to save provider tokens for API access
 */

import { NextRequest, NextResponse } from 'next/server';
import { saveUserTokens } from '@/lib/backend/integrations/auth/google-oauth';
import { getAuthUser } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { accessToken, refreshToken, email } = body;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token required' },
        { status: 400 }
      );
    }

    // Calculate expiry (Google tokens typically expire in 1 hour)
    const expiresAt = new Date(Date.now() + 3600 * 1000);

    // Save tokens to database
    await saveUserTokens(user.userId, {
      accessToken,
      refreshToken,
      expiresAt,
      email: email || user.email,
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ]
    });

    console.log('✅ Google tokens saved for user:', user.email);

    return NextResponse.json({ 
      success: true,
      message: 'Tokens saved successfully'
    });
  } catch (error) {
    console.error('Failed to save Google tokens:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to save tokens',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
