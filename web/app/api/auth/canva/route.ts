/**
 * Canva OAuth Initiation API
 * Start OAuth flow for Canva
 */

import { NextRequest, NextResponse } from 'next/server';
import { initiateCanvaOAuthFlow } from '@/lib/backend/integrations/auth/canva-oauth';
import { getAuthUser } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const authUrl = await initiateCanvaOAuthFlow(user.userId);
    
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Canva OAuth initiation failed:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to initiate Canva OAuth',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
