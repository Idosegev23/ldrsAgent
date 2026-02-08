/**
 * GET /api/dashboard/agents
 * Get all agents with status
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { getAllAgentsStatus } from '@/lib/backend/services/agent-monitor';

export async function GET(request: NextRequest) {
  return requireAuth(request, async () => {
    try {
      const agents = await getAllAgentsStatus();

      return NextResponse.json({
        success: true,
        agents,
        total: agents.length,
      });
    } catch (error) {
      console.error('Failed to get agents:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to get agents',
        },
        { status: 500 }
      );
    }
  });
}
