/**
 * Canva OAuth Status API
 * Check if user is connected to Canva
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserCanvaInfo } from '@backend/integrations/auth/canva-oauth';
import { getAuthUser } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
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

    const canvaInfo = await getUserCanvaInfo(user.userId);
    
    if (!canvaInfo) {
      return NextResponse.json({
        connected: false
      });
    }

    return NextResponse.json({
      connected: canvaInfo.connected,
      userId: canvaInfo.userId,
      connectedAt: canvaInfo.connectedAt,
      scopes: canvaInfo.scopes
    });
  } catch (error) {
    console.error('Failed to check Canva status:', error);
    
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
