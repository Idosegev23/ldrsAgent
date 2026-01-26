/**
 * Jobs Repository
 * CRUD operations for jobs + queue operations
 */

import { v4 as uuidv4 } from 'uuid';
import { getSupabaseAdmin } from '../client.js';
import { logger } from '../../utils/logger.js';
import { APP_CONFIG } from '../../utils/config.js';
import type { Json } from '../database.types.js';
import type {
  Job,
  JobStatus,
  CreateJobInput,
  AgentResult,
  ValidationResult,
  JobState,
  Message,
} from '../../types/job.types.js';
import type { Intent } from '../../types/agent.types.js';
import { createEmptyKnowledgePack, type KnowledgePack } from '../../types/knowledge.types.js';

const log = logger.child({ component: 'JobsRepo' });

/**
 * Create a new job
 */
export async function createJob(input: CreateJobInput): Promise<Job> {
  const supabase = getSupabaseAdmin();
  const jobId = uuidv4();

  const initialState: JobState = {
    decisions: [],
    assumptions: [],
    unresolvedQuestions: [],
    custom: {},
  };

  const { data, error } = await supabase
    .from('jobs')
    .insert({
      id: jobId,
      raw_input: input.rawInput,
      user_id: input.userId,
      client_id: input.clientId,
      parent_job_id: input.parentJobId,
      state: initialState as unknown as Json,
      knowledge_pack: createEmptyKnowledgePack(jobId) as unknown as Json,
    })
    .select()
    .single();

  if (error) {
    log.error('Failed to create job', error);
    throw new Error(`Failed to create job: ${error.message}`);
  }

  log.info('Job created', { jobId });
  return mapRowToJob(data);
}

/**
 * Get job by ID
 */
export async function getJob(jobId: string): Promise<Job | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('jobs')
    .select()
    .eq('id', jobId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get job: ${error.message}`);
  }

  return mapRowToJob(data);
}

/**
 * Claim next pending job (atomic with SKIP LOCKED)
 */
export async function claimNextJob(): Promise<Job | null> {
  const supabase = getSupabaseAdmin();

  // Use RPC for atomic claim
  const { data, error } = await supabase.rpc('claim_next_job');

  if (error) {
    log.error('Failed to claim job', error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  log.info('Job claimed', { jobId: data[0].id });
  return mapRowToJob(data[0]);
}

/**
 * Update job status
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const updates: { status: string; completed_at?: string } = { status };
  if (status === 'done' || status === 'failed') {
    updates.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to update job status: ${error.message}`);
  }

  log.info('Job status updated', { jobId, status });
}

/**
 * Update job intent
 */
export async function updateJobIntent(
  jobId: string,
  intent: Intent
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('jobs')
    .update({ intent: intent as unknown as Json })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to update job intent: ${error.message}`);
  }
}

/**
 * Update job knowledge pack
 */
export async function updateJobKnowledgePack(
  jobId: string,
  knowledgePack: KnowledgePack
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('jobs')
    .update({ knowledge_pack: knowledgePack as unknown as Json })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to update job knowledge pack: ${error.message}`);
  }
}

/**
 * Assign agent to job
 */
export async function assignAgent(
  jobId: string,
  agentId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('jobs')
    .update({ assigned_agent: agentId })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to assign agent: ${error.message}`);
  }

  log.info('Agent assigned', { jobId, agentId });
}

/**
 * Update job result
 */
export async function updateJobResult(
  jobId: string,
  result: AgentResult
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('jobs')
    .update({ result: result as unknown as Json })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to update job result: ${error.message}`);
  }
}

/**
 * Update validation result
 */
export async function updateValidationResult(
  jobId: string,
  validationResult: ValidationResult
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('jobs')
    .update({ validation_result: validationResult as unknown as Json })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to update validation result: ${error.message}`);
  }
}

/**
 * Increment retry count
 */
export async function incrementRetryCount(jobId: string): Promise<number> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('jobs')
    .select('retry_count')
    .eq('id', jobId)
    .single();

  if (error) {
    throw new Error(`Failed to get retry count: ${error.message}`);
  }

  const newCount = (data.retry_count || 0) + 1;

  // Check if max retries exceeded
  if (newCount >= APP_CONFIG.MAX_RETRIES) {
    await updateJobStatus(jobId, 'needs_human_review');
    log.warn('Max retries exceeded', { jobId, retryCount: newCount });
  } else {
    await supabase
      .from('jobs')
      .update({ retry_count: newCount })
      .eq('id', jobId);
  }

  return newCount;
}

/**
 * Add message to job memory
 */
export async function addJobMessage(
  jobId: string,
  message: Omit<Message, 'timestamp'>
): Promise<void> {
  const job = await getJob(jobId);
  if (!job) throw new Error('Job not found');

  const newMessage: Message = {
    ...message,
    timestamp: new Date(),
  };

  const newMemory = [...job.memory, newMessage];

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('jobs')
    .update({ memory: newMemory as unknown as Json })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to add message: ${error.message}`);
  }
}

/**
 * Update job state
 */
export async function updateJobState(
  jobId: string,
  stateUpdate: Partial<JobState>
): Promise<void> {
  const job = await getJob(jobId);
  if (!job) throw new Error('Job not found');

  const newState: JobState = {
    ...job.state,
    ...stateUpdate,
  };

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('jobs')
    .update({ state: newState as unknown as Json })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to update job state: ${error.message}`);
  }
}

/**
 * List jobs by status
 */
export async function listJobsByStatus(
  status: JobStatus,
  limit = 50
): Promise<Job[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('jobs')
    .select()
    .eq('status', status)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list jobs: ${error.message}`);
  }

  return data.map(mapRowToJob);
}

/**
 * List jobs by user
 */
export async function listJobsByUser(
  userId: string,
  limit = 50
): Promise<Job[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('jobs')
    .select()
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list jobs: ${error.message}`);
  }

  return data.map(mapRowToJob);
}

/**
 * Get sub-jobs of a parent job
 */
export async function getSubJobs(parentJobId: string): Promise<Job[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('jobs')
    .select()
    .eq('parent_job_id', parentJobId);

  if (error) {
    throw new Error(`Failed to get sub-jobs: ${error.message}`);
  }

  return data.map(mapRowToJob);
}

// Helper to map DB row to Job type
function mapRowToJob(row: Record<string, unknown>): Job {
  return {
    id: row.id as string,
    status: row.status as JobStatus,
    rawInput: row.raw_input as string,
    intent: row.intent as Intent,
    userId: row.user_id as string,
    clientId: row.client_id as string | undefined,
    knowledgePack: row.knowledge_pack as KnowledgePack,
    assignedAgent: row.assigned_agent as string,
    subJobs: [],
    parentJobId: row.parent_job_id as string | undefined,
    state: row.state as JobState,
    memory: (row.memory as Message[]) || [],
    result: row.result as AgentResult | undefined,
    validationResult: row.validation_result as ValidationResult | undefined,
    retryCount: row.retry_count as number,
    maxRetries: APP_CONFIG.MAX_RETRIES,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    completedAt: row.completed_at
      ? new Date(row.completed_at as string)
      : undefined,
  };
}
