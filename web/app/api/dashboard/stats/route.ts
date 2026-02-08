/**
 * GET /api/dashboard/stats
 * Get overall system statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { getSystemStats } from '@/lib/backend/services/agent-monitor';

export async function GET(request: NextRequest) {
  return requireAuth(request, async () => {
    try {
      const stats = await getSystemStats();

      return NextResponse.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('Failed to get system stats:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to get system statistics',
        },
        { status: 500 }
      );
    }
  });
}
