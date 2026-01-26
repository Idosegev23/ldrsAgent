/**
 * Session Manager
 * Create, validate, and revoke user sessions
 */

import { getSupabaseAdmin } from '../db/client.js';
import { logger } from '../utils/logger.js';
import {
  signToken,
  signRefreshToken,
  verifyToken,
  hashToken,
  getTokenExpiry,
  getRefreshTokenExpiry,
  type JWTPayload,
} from './jwt.utils.js';

const log = logger.child({ component: 'SessionManager' });

export interface SessionInfo {
  sessionId: string;
  token: string;
  refreshToken: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
}

export interface SessionValidation {
  valid: boolean;
  userId?: string;
  email?: string;
  role?: string;
  sessionId?: string;
}

/**
 * Create a new session for a user
 */
export async function createSession(
  userId: string,
  email: string,
  role: string,
  ipAddress?: string,
  userAgent?: string
): Promise<SessionInfo> {
  log.info('Creating session', { userId, email });

  const supabase = getSupabaseAdmin();

  // Generate session ID
  const sessionId = crypto.randomUUID();

  // Generate tokens
  const tokenPayload: JWTPayload = { userId, email, role, sessionId };
  const token = signToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  // Hash tokens for storage
  const tokenHash = hashToken(token);
  const refreshTokenHash = hashToken(refreshToken);

  // Calculate expiry dates
  const expiresAt = getTokenExpiry();
  const refreshExpiresAt = getRefreshTokenExpiry();

  // Store session in database
  const { error } = await supabase.from('auth_sessions').insert({
    id: sessionId,
    user_id: userId,
    token_hash: tokenHash,
    refresh_token_hash: refreshTokenHash,
    expires_at: expiresAt.toISOString(),
    refresh_expires_at: refreshExpiresAt.toISOString(),
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  if (error) {
    log.error('Failed to create session', error, { userId });
    throw new Error('Failed to create session');
  }

  // Update user's last login
  await supabase
    .from('users')
    .update({
      last_login_at: new Date().toISOString(),
      login_count: supabase.rpc('increment', { x: 1 }),
    })
    .eq('id', userId);

  log.info('Session created', { userId, sessionId });

  return {
    sessionId,
    token,
    refreshToken,
    expiresAt,
    refreshExpiresAt,
  };
}

/**
 * Validate a session token
 */
export async function validateSession(token: string): Promise<SessionValidation> {
  // Verify JWT
  const payload = verifyToken(token);
  if (!payload) {
    return { valid: false };
  }

  // Check session exists in database
  const supabase = getSupabaseAdmin();
  const tokenHash = hashToken(token);

  const { data: session, error } = await supabase
    .from('auth_sessions')
    .select('id, user_id, expires_at')
    .eq('token_hash', tokenHash)
    .single();

  if (error || !session) {
    log.debug('Session not found in database', { sessionId: payload.sessionId });
    return { valid: false };
  }

  // Check expiry
  const expiresAt = new Date(session.expires_at);
  if (expiresAt < new Date()) {
    log.debug('Session expired', { sessionId: session.id });
    return { valid: false };
  }

  // Update last activity
  await supabase
    .from('auth_sessions')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', session.id);

  return {
    valid: true,
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    sessionId: payload.sessionId,
  };
}

/**
 * Refresh a session using refresh token
 */
export async function refreshSession(refreshToken: string): Promise<SessionInfo | null> {
  log.info('Refreshing session');

  // Verify refresh token
  const payload = verifyToken(refreshToken);
  if (!payload) {
    return null;
  }

  // Check session exists and refresh token matches
  const supabase = getSupabaseAdmin();
  const refreshTokenHash = hashToken(refreshToken);

  const { data: session, error } = await supabase
    .from('auth_sessions')
    .select('*')
    .eq('id', payload.sessionId)
    .eq('refresh_token_hash', refreshTokenHash)
    .single();

  if (error || !session) {
    log.warn('Refresh token not found', { sessionId: payload.sessionId });
    return null;
  }

  // Check refresh token expiry
  const refreshExpiresAt = new Date(session.refresh_expires_at);
  if (refreshExpiresAt < new Date()) {
    log.info('Refresh token expired', { sessionId: session.id });
    return null;
  }

  // Generate new tokens
  const newToken = signToken({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    sessionId: session.id,
  });
  const newRefreshToken = signRefreshToken({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    sessionId: session.id,
  });

  // Update session with new token hashes
  const newTokenHash = hashToken(newToken);
  const newRefreshTokenHash = hashToken(newRefreshToken);
  const newExpiresAt = getTokenExpiry();
  const newRefreshExpiresAt = getRefreshTokenExpiry();

  await supabase
    .from('auth_sessions')
    .update({
      token_hash: newTokenHash,
      refresh_token_hash: newRefreshTokenHash,
      expires_at: newExpiresAt.toISOString(),
      refresh_expires_at: newRefreshExpiresAt.toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', session.id);

  log.info('Session refreshed', { sessionId: session.id });

  return {
    sessionId: session.id,
    token: newToken,
    refreshToken: newRefreshToken,
    expiresAt: newExpiresAt,
    refreshExpiresAt: newRefreshExpiresAt,
  };
}

/**
 * Revoke a session
 */
export async function revokeSession(sessionId: string): Promise<void> {
  log.info('Revoking session', { sessionId });

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('auth_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    log.error('Failed to revoke session', error, { sessionId });
    throw new Error('Failed to revoke session');
  }

  log.info('Session revoked', { sessionId });
}

/**
 * Revoke all sessions for a user
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  log.info('Revoking all sessions for user', { userId });

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('auth_sessions')
    .delete()
    .eq('user_id', userId);

  if (error) {
    log.error('Failed to revoke all user sessions', error, { userId });
    throw new Error('Failed to revoke all user sessions');
  }

  log.info('All user sessions revoked', { userId });
}

/**
 * Clean expired sessions
 */
export async function cleanExpiredSessions(): Promise<void> {
  log.info('Cleaning expired sessions');

  const supabase = getSupabaseAdmin();

  const { error } = await supabase.rpc('clean_expired_sessions');

  if (error) {
    log.error('Failed to clean expired sessions', error);
  } else {
    log.info('Expired sessions cleaned');
  }
}
