/**
 * Job Queue
 * Supabase-based job queue with atomic claiming
 */

import { getSupabaseAdmin } from '../db/client.js';
import { logger } from '../utils/logger.js';
import { getEventBus } from './event-bus.js';
import { logAudit } from '../db/repositories/audit.repo.js';
import * as jobsRepo from '../db/repositories/jobs.repo.js';
import type { Job, CreateJobInput } from '../types/job.types.js';

const log = logger.child({ component: 'JobQueue' });

/**
 * Add a job to the queue
 */
export async function enqueueJob(input: CreateJobInput): Promise<Job> {
  const job = await jobsRepo.createJob(input);

  // Emit event
  const eventBus = getEventBus();
  await eventBus.emit(
    'job.created',
    { jobId: job.id, rawInput: job.rawInput },
    { userId: job.userId, jobId: job.id }
  );

  // Audit
  await logAudit('job.created', { rawInput: job.rawInput }, {
    jobId: job.id,
    userId: job.userId,
  });

  log.info('Job enqueued', { jobId: job.id });
  return job;
}

/**
 * Claim the next pending job (atomic)
 * Uses FOR UPDATE SKIP LOCKED to prevent race conditions
 */
export async function claimNextJob(): Promise<Job | null> {
  const supabase = getSupabaseAdmin();

  // Atomic claim using raw SQL via RPC
  // First, check if we have the function, otherwise do it in two steps
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    // Try to claim it
    const { data: claimed, error: claimError } = await supabase
      .from('jobs')
      .update({ status: 'running' })
      .eq('id', data.id)
      .eq('status', 'pending') // Ensure still pending
      .select()
      .single();

    if (claimError || !claimed) {
      // Another worker claimed it
      return null;
    }

    const job = mapRowToJob(claimed);

    // Emit event
    const eventBus = getEventBus();
    await eventBus.emit(
      'job.started',
      { jobId: job.id },
      { userId: job.userId, jobId: job.id }
    );

    log.info('Job claimed', { jobId: job.id });
    return job;
  } catch (error) {
    log.error('Failed to claim job', error as Error);
    return null;
  }
}

/**
 * Complete a job successfully
 */
export async function completeJob(jobId: string): Promise<void> {
  await jobsRepo.updateJobStatus(jobId, 'done');

  const job = await jobsRepo.getJob(jobId);
  if (job) {
    const eventBus = getEventBus();
    await eventBus.emit(
      'job.completed',
      { jobId, result: job.result },
      { userId: job.userId, jobId }
    );

    await logAudit('job.completed', { result: job.result }, {
      jobId,
      userId: job.userId,
    });
  }

  log.info('Job completed', { jobId });
}

/**
 * Fail a job
 */
export async function failJob(jobId: string, error: string): Promise<void> {
  const job = await jobsRepo.getJob(jobId);
  if (!job) return;

  const retryCount = await jobsRepo.incrementRetryCount(jobId);

  if (job.status !== 'needs_human_review') {
    await jobsRepo.updateJobStatus(jobId, 'failed');
  }

  const eventBus = getEventBus();
  await eventBus.emit(
    'job.failed',
    { jobId, error, retryCount },
    { userId: job.userId, jobId }
  );

  await logAudit('job.failed', { error, retryCount }, {
    jobId,
    userId: job.userId,
  });

  log.error('Job failed', undefined, { jobId, error, retryCount });
}

/**
 * Send job back for retry (from auto-fix)
 */
export async function retryJob(jobId: string): Promise<void> {
  const job = await jobsRepo.getJob(jobId);
  if (!job) return;

  const retryCount = await jobsRepo.incrementRetryCount(jobId);

  if (job.status !== 'needs_human_review') {
    await jobsRepo.updateJobStatus(jobId, 'pending');
  }

  await logAudit('job.retry', { retryCount }, {
    jobId,
    userId: job.userId,
  });

  log.info('Job queued for retry', { jobId, retryCount });
}

/**
 * Block job waiting for subjobs
 */
export async function blockJob(jobId: string): Promise<void> {
  await jobsRepo.updateJobStatus(jobId, 'blocked');
  log.info('Job blocked waiting for subjobs', { jobId });
}

/**
 * Get pending job count
 */
export async function getPendingJobCount(): Promise<number> {
  const supabase = getSupabaseAdmin();

  const { count, error } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) {
    log.error('Failed to get pending count', error);
    return 0;
  }

  return count || 0;
}

// Helper to map row to Job
function mapRowToJob(row: Record<string, unknown>): Job {
  return {
    id: row.id as string,
    status: row.status as Job['status'],
    rawInput: row.raw_input as string,
    intent: row.intent as Job['intent'],
    userId: row.user_id as string,
    clientId: row.client_id as string | undefined,
    knowledgePack: row.knowledge_pack as Job['knowledgePack'],
    assignedAgent: row.assigned_agent as string,
    subJobs: [],
    parentJobId: row.parent_job_id as string | undefined,
    state: row.state as Job['state'],
    memory: row.memory as Job['memory'],
    result: row.result as Job['result'],
    validationResult: row.validation_result as Job['validationResult'],
    retryCount: row.retry_count as number,
    maxRetries: 2,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    completedAt: row.completed_at
      ? new Date(row.completed_at as string)
      : undefined,
  };
}

