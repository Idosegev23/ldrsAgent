/**
 * Serverless-compatible Job Store
 * Uses Supabase for persistence
 */

import { createClient } from '@supabase/supabase-js';
import type { Job, JobStatus } from '../types/job.types';

// Initialize Supabase client (serverless-safe)
const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }
  
  return createClient(supabaseUrl, supabaseKey);
};

export async function getJob(jobId: string): Promise<Job | null> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  
  if (error) {
    console.error('Error fetching job:', error);
    return null;
  }
  
  return data as Job;
}

export async function updateJob(jobId: string, updates: Partial<Job>): Promise<Job | null> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', jobId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating job:', error);
    return null;
  }
  
  return data as Job;
}

export async function createJob(job: Omit<Job, 'id' | 'createdAt'>): Promise<Job | null> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('jobs')
    .insert([job])
    .select()
    .single();
  
  if (error) {
    console.error('Error creating job:', error);
    return null;
  }
  
  return data as Job;
}

export function getJobStore() {
  return {
    getJob,
    updateJob,
    createJob,
  };
}
