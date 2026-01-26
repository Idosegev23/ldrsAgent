/**
 * GET /api/jobs/:id/actions - Get pending actions for a job
 * POST /api/jobs/:id/actions - Execute a pending action
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { getJob } from '@backend/control/job-store';
import { getJobPendingActions, executeAction, rejectAction } from '@backend/execution/action-executor';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return requireAuth(request, async (req, user) => {
    try {
      const { id } = await params;
      const job = getJob(id);

      if (!job) {
        return NextResponse.json(
          {
            success: false,
            error: 'Job not found',
          },
          { status: 404 }
        );
      }

      // Check if user owns this job
      if (job.userId !== user.userId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Unauthorized',
          },
          { status: 403 }
        );
      }

      // Get pending actions
      const pendingActions = getJobPendingActions(id);

      return NextResponse.json({
        success: true,
        actions: pendingActions,
      });
    } catch (error) {
      console.error('Failed to get pending actions:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to get pending actions',
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
      const { id: jobId } = await params;
      const body = await request.json();
      const { actionId, action } = body;

      if (!actionId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Action ID is required',
          },
          { status: 400 }
        );
      }

      const job = getJob(jobId);

      if (!job) {
        return NextResponse.json(
          {
            success: false,
            error: 'Job not found',
          },
          { status: 404 }
        );
      }

      // Check if user owns this job
      if (job.userId !== user.userId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Unauthorized',
          },
          { status: 403 }
        );
      }

      // Handle action approval/rejection
      if (action === 'approve' || action === 'execute') {
        // Execute the action
        const result = await executeAction(actionId);

        return NextResponse.json({
          success: result.success,
          message: result.message,
        });
      } else if (action === 'reject' || action === 'cancel') {
        // Reject the action
        rejectAction(actionId);

        return NextResponse.json({
          success: true,
          message: 'הפעולה בוטלה',
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid action',
          },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error('Failed to execute action:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to execute action',
          details: (error as Error).message,
        },
        { status: 500 }
      );
    }
  });
}
