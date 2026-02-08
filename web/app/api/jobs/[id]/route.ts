/**
 * GET /api/jobs/:id - Get job by ID
 * DELETE /api/jobs/:id - Cancel a job
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { getJob, updateJob } from '@/lib/backend/control/job-store';

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

      return NextResponse.json({
        success: true,
        job: {
          id: job.id,
          status: job.status,
          intent: job.intent,
          assignedAgent: job.assignedAgent,
          result: job.result,
          validationResult: job.validationResult,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          completedAt: job.completedAt,
        },
      });
    } catch (error) {
      console.error('Failed to get job:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to get job',
        },
        { status: 500 }
      );
    }
  });
}

export async function DELETE(
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

      if (job.status === 'done' || job.status === 'failed') {
        return NextResponse.json(
          {
            success: false,
            error: 'Cannot cancel completed job',
          },
          { status: 400 }
        );
      }

      job.status = 'failed';
      job.updatedAt = new Date();
      job.result = {
        success: false,
        output: 'Job cancelled by user',
        citations: [],
        confidence: 'low',
        nextAction: 'done',
      };

      return NextResponse.json({
        success: true,
        message: 'Job cancelled',
      });
    } catch (error) {
      console.error('Failed to cancel job:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to cancel job',
        },
        { status: 500 }
      );
    }
  });
}
