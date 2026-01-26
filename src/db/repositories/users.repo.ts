/**
 * Users Repository
 * CRUD operations for users
 */

import { v4 as uuidv4 } from 'uuid';
import { getSupabaseAdmin } from '../client.js';
import { logger } from '../../utils/logger.js';
import type { User, UserRole, UserPreferences } from '../../types/user.types.js';

const log = logger.child({ component: 'UsersRepo' });

/**
 * Create a new user
 */
export async function createUser(input: {
  email: string;
  name?: string;
  phone?: string;
  role?: UserRole;
}): Promise<User> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('users')
    .insert({
      id: uuidv4(),
      email: input.email,
      name: input.name,
      phone: input.phone,
      role: input.role || 'user',
    })
    .select()
    .single();

  if (error) {
    log.error('Failed to create user', error);
    throw new Error(`Failed to create user: ${error.message}`);
  }

  log.info('User created', { userId: data.id, email: input.email });
  return mapRowToUser(data);
}

/**
 * Get user by ID
 */
export async function getUser(userId: string): Promise<User | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('users')
    .select()
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get user: ${error.message}`);
  }

  return mapRowToUser(data);
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('users')
    .select()
    .eq('email', email)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get user: ${error.message}`);
  }

  return mapRowToUser(data);
}

/**
 * Get or create user by email
 */
export async function getOrCreateUser(email: string, name?: string): Promise<User> {
  let user = await getUserByEmail(email);
  
  if (!user) {
    user = await createUser({ email, name });
  }
  
  return user;
}

/**
 * Update user
 */
export async function updateUser(
  userId: string,
  updates: Partial<{
    name: string;
    phone: string;
    role: UserRole;
    teamId: string;
    clientIds: string[];
    preferences: UserPreferences;
  }>
): Promise<User> {
  const supabase = getSupabaseAdmin();

  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
  if (updates.role !== undefined) dbUpdates.role = updates.role;
  if (updates.teamId !== undefined) dbUpdates.team_id = updates.teamId;
  if (updates.clientIds !== undefined) dbUpdates.client_ids = updates.clientIds;
  if (updates.preferences !== undefined) dbUpdates.preferences = updates.preferences;

  const { data, error } = await supabase
    .from('users')
    .update(dbUpdates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update user: ${error.message}`);
  }

  return mapRowToUser(data);
}

/**
 * Add client to user's allowed list
 */
export async function addClientToUser(
  userId: string,
  clientId: string
): Promise<void> {
  const user = await getUser(userId);
  if (!user) throw new Error('User not found');

  if (!user.clientIds.includes(clientId)) {
    await updateUser(userId, {
      clientIds: [...user.clientIds, clientId],
    });
  }
}

/**
 * List users by team
 */
export async function listUsersByTeam(teamId: string): Promise<User[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('users')
    .select()
    .eq('team_id', teamId);

  if (error) {
    throw new Error(`Failed to list users: ${error.message}`);
  }

  return data.map(mapRowToUser);
}

// Helper to map DB row to User type
function mapRowToUser(row: Record<string, unknown>): User {
  const preferences = row.preferences as Record<string, unknown> || {};
  
  return {
    id: row.id as string,
    email: row.email as string,
    phone: row.phone as string | undefined,
    name: (row.name as string) || '',
    role: row.role as UserRole,
    teamId: row.team_id as string | undefined,
    clientIds: (row.client_ids as string[]) || [],
    preferences: {
      morningBriefing: preferences.morningBriefing as boolean ?? true,
      whatsappNotifications: preferences.whatsappNotifications as boolean ?? true,
      emailNotifications: preferences.emailNotifications as boolean ?? true,
      language: (preferences.language as 'he' | 'en') || 'he',
    },
    createdAt: new Date(row.created_at as string),
  };
}

