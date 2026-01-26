/**
 * GET /api/jobs/:id/result
 * Get job result (output only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { getJob } from '@backend/control/job-store';

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

      if (job.status === 'pending' || job.status === 'running') {
        return NextResponse.json(
          {
            success: true,
            status: job.status,
            message: 'Job is still processing',
          },
          { status: 202 }
        );
      }

      if (job.status === 'failed') {
        // Return friendly error message
        let errorMessage = job.result?.output || 'העיבוד נכשל';
        
        // Make error messages more user-friendly
        if (errorMessage.includes('Agent not found')) {
          errorMessage = 'הסוכן המבוקש לא נמצא. נסה שוב או בחר סוכן אחר.';
        }
        
        return NextResponse.json({
          success: false,
          status: 'failed',
          error: errorMessage,
        });
      }

      // Success - return with friendly status and pending actions
      // Normalize status to 'completed' for frontend
      const normalizedStatus = (job.status === 'done' || job.status === 'completed' || job.status === 'success') 
        ? 'completed' 
        : job.status;
      
      return NextResponse.json({
        success: true,
        status: normalizedStatus,
        output: job.result?.output,
        confidence: job.result?.confidence,
        agentName: job.assignedAgent,
        pendingAction: job.result?.pendingAction,
      });
    } catch (error) {
      console.error('Failed to get job result:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to get job result',
        },
        { status: 500 }
      );
    }
  });
}
