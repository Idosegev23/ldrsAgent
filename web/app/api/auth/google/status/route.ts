/**
 * Google OAuth Status API
 * Check if user is connected to Google
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserGoogleInfo } from '@/lib/backend/integrations/auth/google-oauth';
import { getAuthUser } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from Supabase session
    const user = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json(
        { 
          connected: false,
          error: 'Authentication required'
        },
        { status: 401 }
      );
    }

    // Check Google connection status
    const googleInfo = await getUserGoogleInfo(user.userId);
    
    if (!googleInfo) {
      return NextResponse.json({
        connected: false
      });
    }

    return NextResponse.json({
      connected: googleInfo.connected,
      email: googleInfo.email,
      connectedAt: googleInfo.connectedAt,
      scopes: googleInfo.scopes
    });
  } catch (error) {
    console.error('Failed to check OAuth status:', error);
    
    return NextResponse.json(
      {
        connected: false,
        error: 'Failed to check status',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
