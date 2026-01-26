/**
 * GET /api/jobs - List jobs
 * POST /api/jobs - Create a new job
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { classifyIntent } from '@backend/control/intent-classifier';
import { orchestrateJob } from '@backend/control/orchestrator';
import { getJobStore, updateJob, getJob } from '@backend/control/job-store';
import { v4 as uuidv4 } from 'uuid';
import type { Job, JobStatus } from '@backend/types/job.types';

export async function GET(request: NextRequest) {
  return requireAuth(request, async (req, user) => {
    try {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get('status') as JobStatus | null;
      const limit = parseInt(searchParams.get('limit') || '20');
      const offset = parseInt(searchParams.get('offset') || '0');

      const jobStore = getJobStore();
      let jobs = Array.from(jobStore.values());

      // Filter by user
      jobs = jobs.filter(j => j.userId === user.userId);

      // Filter by status
      if (status) {
        jobs = jobs.filter(j => j.status === status);
      }

      // Sort by createdAt descending
      jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Paginate
      const total = jobs.length;
      jobs = jobs.slice(offset, offset + limit);

      return NextResponse.json({
        success: true,
        jobs: jobs.map(j => ({
          id: j.id,
          status: j.status,
          intent: j.intent.primary,
          assignedAgent: j.assignedAgent,
          createdAt: j.createdAt,
          updatedAt: j.updatedAt,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (error) {
      console.error('Failed to list jobs:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to list jobs',
        },
        { status: 500 }
      );
    }
  });
}

export async function POST(request: NextRequest) {
  return requireAuth(request, async (req, user) => {
    try {
      const body = await request.json();
      const { input, clientId, agentId } = body;

      if (!input || typeof input !== 'string' || input.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Input is required',
          },
          { status: 400 }
        );
      }

      console.log('Creating new job', { input: input.slice(0, 100), userId: user.userId });

      // Classify intent
      const intent = await classifyIntent(input);

      // Create job
      const job: Job = {
        id: uuidv4(),
        status: 'pending',
        rawInput: input,
        intent,
        userId: user.userId,
        clientId,
        knowledgePack: {
          jobId: '',
          ready: false,
          documents: [],
          chunks: [],
          missing: [],
          searchQuery: '',
          confidence: 0,
          retrievedAt: new Date(),
          status: 'pending',
        },
        assignedAgent: agentId || '',
        subJobs: [],
        state: {
          decisions: [],
          assumptions: [],
          unresolvedQuestions: [],
          custom: {},
        },
        memory: [],
        retryCount: 0,
        maxRetries: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      job.knowledgePack.jobId = job.id;

      // Store job
      updateJob(job);

      // Start orchestration in background
      orchestrateJob(job.id).catch((err: Error) => {
        console.error('Job orchestration failed', { jobId: job.id, error: err });
        const storedJob = getJob(job.id);
        if (storedJob) {
          storedJob.status = 'failed';
          storedJob.updatedAt = new Date();
          updateJob(storedJob);
        }
      });

      return NextResponse.json(
        {
          success: true,
          job: {
            id: job.id,
            status: job.status,
            intent: job.intent,
            createdAt: job.createdAt,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('Failed to create job:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create job',
        },
        { status: 500 }
      );
    }
  });
}

// Job store functions are now imported from @backend/control/job-store
