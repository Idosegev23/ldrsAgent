/**
 * Google OAuth Initiation API
 * Start OAuth flow for Google services
 */

import { NextRequest, NextResponse } from 'next/server';
import { initiateOAuthFlow } from '@backend/integrations/auth/google-oauth';
import { getAuthUser } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from Supabase session
    const user = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Initiate OAuth flow with user ID
    const authUrl = await initiateOAuthFlow(user.userId);
    
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('OAuth initiation failed:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to initiate OAuth flow',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
