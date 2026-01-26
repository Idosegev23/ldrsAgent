/**
 * GET /api/dashboard/agents/:id
 * Get specific agent details, stats, and executions
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { 
  getAgentStatus, 
  getAgentStats,
  getAgentExecutions 
} from '@backend/services/agent-monitor';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return requireAuth(request, async () => {
    try {
      const { id } = await params;
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action');

      // Handle different actions
      if (action === 'stats') {
        const startTime = searchParams.get('startTime');
        const endTime = searchParams.get('endTime');

        const start = startTime ? new Date(startTime) : undefined;
        const end = endTime ? new Date(endTime) : undefined;

        const stats = await getAgentStats(id, start, end);

        return NextResponse.json({
          success: true,
          stats: stats || null,
        });
      }

      if (action === 'executions') {
        const limit = searchParams.get('limit');
        const executions = await getAgentExecutions(id, limit ? parseInt(limit) : 50);

        return NextResponse.json({
          success: true,
          executions,
          total: executions.length,
        });
      }

      // Default: get agent status
      const agent = await getAgentStatus(id);

      if (!agent) {
        return NextResponse.json(
          {
            success: false,
            error: 'Agent not found',
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        agent,
      });
    } catch (error) {
      console.error('Failed to get agent:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to get agent',
        },
        { status: 500 }
      );
    }
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return requireAuth(request, async (req, user) => {
    try {
      const { id } = await params;
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action');

      // Only admins can enable/disable agents
      if (user.role !== 'admin') {
        return NextResponse.json(
          {
            success: false,
            error: 'Only admins can enable/disable agents',
          },
          { status: 403 }
        );
      }

      const { setAgentEnabled } = await import('@backend/services/agent-monitor');

      if (action === 'enable') {
        await setAgentEnabled(id, true);
        console.log('Agent enabled', { agentId: id, userId: user.userId });

        return NextResponse.json({
          success: true,
          message: 'Agent enabled successfully',
        });
      }

      if (action === 'disable') {
        await setAgentEnabled(id, false);
        console.log('Agent disabled', { agentId: id, userId: user.userId });

        return NextResponse.json({
          success: true,
          message: 'Agent disabled successfully',
        });
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action',
        },
        { status: 400 }
      );
    } catch (error) {
      console.error('Failed to update agent:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update agent',
        },
        { status: 500 }
      );
    }
  });
}
