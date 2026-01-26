/**
 * GET /api/dashboard/integrations
 * Get all integrations health status (Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';
import { checkIntegrationsHealth } from '@backend/services/agent-monitor';

export async function GET(request: NextRequest) {
  return requireAdmin(request, async () => {
    try {
      const integrations = await checkIntegrationsHealth();

      return NextResponse.json({
        success: true,
        integrations,
        total: integrations.length,
      });
    } catch (error) {
      console.error('Failed to get integrations:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to get integrations',
        },
        { status: 500 }
      );
    }
  });
}
