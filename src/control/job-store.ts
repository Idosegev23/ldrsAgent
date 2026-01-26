/**
 * Job Store
 * Shared in-memory job storage for orchestrator and API routes
 * Uses globalThis to persist across Next.js module reloads
 * In production, this should use Supabase
 */

import type { Job } from '../types/job.types.js';

// Extend globalThis to include our job store
declare global {
  // eslint-disable-next-line no-var
  var __jobStore: Map<string, Job> | undefined;
}

// Use globalThis to persist job store across module reloads in development
// This ensures the same Map instance is used across all API routes
function getOrCreateJobStore(): Map<string, Job> {
  if (!globalThis.__jobStore) {
    globalThis.__jobStore = new Map<string, Job>();
  }
  return globalThis.__jobStore;
}

export function getJobStore(): Map<string, Job> {
  return getOrCreateJobStore();
}

export function updateJob(job: Job): void {
  const store = getOrCreateJobStore();
  store.set(job.id, job);
}

export function getJob(jobId: string): Job | undefined {
  const store = getOrCreateJobStore();
  return store.get(jobId);
}

export function deleteJob(jobId: string): boolean {
  const store = getOrCreateJobStore();
  return store.delete(jobId);
}

export function getAllJobs(): Job[] {
  const store = getOrCreateJobStore();
  return Array.from(store.values());
}

export function clearJobs(): void {
  const store = getOrCreateJobStore();
  store.clear();
}
