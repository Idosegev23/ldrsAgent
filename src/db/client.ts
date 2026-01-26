/**
 * Supabase Client
 * Database connection and utilities
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getConfig } from '../utils/config.js';
import type { Database } from './database.types.js';

let supabaseClient: SupabaseClient<Database> | null = null;
let supabaseAdmin: SupabaseClient<Database> | null = null;

/**
 * Get Supabase client (anon key - for user-level operations)
 */
export function getSupabase(): SupabaseClient<Database> {
  if (supabaseClient) return supabaseClient;

  const config = getConfig();
  supabaseClient = createClient<Database>(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY
  );

  return supabaseClient;
}

/**
 * Get Supabase admin client (service role key - for server operations)
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (supabaseAdmin) return supabaseAdmin;

  const config = getConfig();
  supabaseAdmin = createClient<Database>(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY
  );

  return supabaseAdmin;
}

/**
 * Execute a raw SQL query (for migrations)
 * Note: This requires a custom function in Supabase
 */
export async function executeSQL(_sql: string): Promise<void> {
  // Note: Raw SQL execution should be done via Supabase SQL Editor
  // or via the Supabase CLI migration system
  console.log('SQL execution should be done via Supabase SQL Editor');
}

// Export supabase as named export for orchestration system
export const supabase = getSupabaseAdmin();

