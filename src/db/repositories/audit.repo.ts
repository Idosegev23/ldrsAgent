/**
 * Audit Repository
 * Audit log operations
 */

import { v4 as uuidv4 } from 'uuid';
import { getSupabaseAdmin } from '../client.js';
import type { Json } from '../database.types.js';

export interface AuditEntry {
  id: string;
  jobId?: string;
  userId?: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

export type AuditAction =
  | 'job.created'
  | 'job.started'
  | 'job.completed'
  | 'job.failed'
  | 'job.retry'
  | 'intent.classified'
  | 'knowledge.retrieved'
  | 'agent.assigned'
  | 'agent.executed'
  | 'validation.passed'
  | 'validation.failed'
  | 'integration.called'
  | 'user.created'
  | 'error.occurred';

/**
 * Log an audit entry
 */
export async function logAudit(
  action: AuditAction,
  details: Record<string, unknown>,
  options?: {
    jobId?: string;
    userId?: string;
  }
): Promise<void> {
  const supabase = getSupabaseAdmin();

  await supabase.from('audit_log').insert({
    id: uuidv4(),
    action,
    details: details as unknown as Json,
    job_id: options?.jobId,
    user_id: options?.userId,
  });
}

/**
 * Get audit entries for a job
 */
export async function getJobAuditLog(jobId: string): Promise<AuditEntry[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('audit_log')
    .select()
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get audit log: ${error.message}`);
  }

  return data.map(mapRowToAuditEntry);
}

/**
 * Get recent audit entries by action
 */
export async function getRecentAuditByAction(
  action: AuditAction,
  limit = 100
): Promise<AuditEntry[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('audit_log')
    .select()
    .eq('action', action)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get audit log: ${error.message}`);
  }

  return data.map(mapRowToAuditEntry);
}

// Helper
function mapRowToAuditEntry(row: Record<string, unknown>): AuditEntry {
  return {
    id: row.id as string,
    jobId: row.job_id as string | undefined,
    userId: row.user_id as string | undefined,
    action: row.action as string,
    details: row.details as Record<string, unknown>,
    createdAt: new Date(row.created_at as string),
  };
}

