/**
 * POST /api/dashboard/sync
 * Sync agents registry from code (Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { syncAgentsRegistry } from '@/lib/backend/services/agent-monitor';

export async function POST(request: NextRequest) {
  return requireAdmin(request, async (req, user) => {
    try {
      await syncAgentsRegistry();

      console.log('Agents registry synced', { userId: user.userId });

      return NextResponse.json({
        success: true,
        message: 'Agents registry synced successfully',
      });
    } catch (error) {
      console.error('Failed to sync agents registry:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to sync agents registry',
        },
        { status: 500 }
      );
    }
  });
}
