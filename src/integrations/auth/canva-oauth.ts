/**
 * Canva OAuth Manager
 * Handles OAuth 2.0 with PKCE flow for Canva Connect API
 */

import { createHash, randomBytes } from 'crypto';
import { getSupabaseAdmin } from '../../db/client.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'CanvaOAuth' });

export interface CanvaOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  userId: string;
  scopes: string[];
}

const CANVA_SCOPES = [
  'design:meta:read',
  'design:content:read',
  'design:content:write',
  'asset:read',
  'asset:write',
  'brandtemplate:meta:read',
  'brandtemplate:content:read',
  'folder:read',
  'folder:write',
  'profile:read',
];

const CANVA_AUTH_URL = 'https://www.canva.com/api/oauth/authorize';
const CANVA_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';

// Temporary storage for code_verifier (in production, use Redis or similar)
const codeVerifierStore = new Map<string, string>();

/**
 * Generate PKCE code_verifier
 */
function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Generate PKCE code_challenge from verifier
 */
function generateCodeChallenge(verifier: string): string {
  return createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

/**
 * Initiate OAuth flow - returns authorization URL
 */
export async function initiateCanvaOAuthFlow(userId: string): Promise<string> {
  log.info('Initiating Canva OAuth flow', { userId });

  const clientId = process.env.CANVA_CLIENT_ID;
  const redirectUri = process.env.CANVA_REDIRECT_URI || 
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000'}/api/auth/canva/callback`;

  if (!clientId) {
    throw new Error('CANVA_CLIENT_ID not configured');
  }

  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  
  // Store code_verifier temporarily (expires in 10 minutes)
  codeVerifierStore.set(userId, codeVerifier);
  setTimeout(() => codeVerifierStore.delete(userId), 10 * 60 * 1000);

  // Build authorization URL
  const authUrl = new URL(CANVA_AUTH_URL);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', CANVA_SCOPES.join(' '));
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', userId); // Pass userId as state

  log.info('Canva OAuth URL generated', { userId });
  return authUrl.toString();
}

/**
 * Handle OAuth callback - exchange code for tokens
 */
export async function handleCanvaOAuthCallback(
  code: string,
  userId: string
): Promise<CanvaOAuthTokens> {
  log.info('Handling Canva OAuth callback', { userId });

  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  const redirectUri = process.env.CANVA_REDIRECT_URI || 
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000'}/api/auth/canva/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Canva OAuth credentials not configured');
  }

  // Retrieve code_verifier
  const codeVerifier = codeVerifierStore.get(userId);
  if (!codeVerifier) {
    throw new Error('Code verifier not found or expired');
  }

  try {
    // Exchange code for tokens
    const response = await fetch(CANVA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();

    // Clean up code_verifier
    codeVerifierStore.delete(userId);

    const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

    log.info('Canva OAuth callback successful', { userId });

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      userId: data.user?.id || userId,
      scopes: data.scope?.split(' ') || CANVA_SCOPES,
    };
  } catch (error) {
    log.error('Canva OAuth callback failed', error as Error, { userId });
    throw error;
  }
}

/**
 * Save user tokens to database
 */
export async function saveCanvaTokens(
  userId: string,
  tokens: CanvaOAuthTokens
): Promise<void> {
  log.info('Saving Canva tokens', { userId });

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('users')
    .update({
      canva_access_token: tokens.accessToken,
      canva_refresh_token: tokens.refreshToken,
      canva_token_expires_at: tokens.expiresAt.toISOString(),
      canva_user_id: tokens.userId,
      canva_scopes: tokens.scopes,
      canva_connected_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    log.error('Failed to save Canva tokens', error as Error, { userId });
    throw error;
  }

  log.info('Canva tokens saved successfully', { userId });
}

/**
 * Get valid access token (refresh if needed)
 */
export async function getValidCanvaToken(userId: string): Promise<string> {
  log.info('Getting valid Canva token', { userId });

  const supabase = getSupabaseAdmin();

  const { data: user, error } = await supabase
    .from('users')
    .select('canva_access_token, canva_refresh_token, canva_token_expires_at')
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new Error('User not found');
  }

  if (!user.canva_access_token) {
    throw new Error('Canva not connected');
  }

  // Check if token is still valid (with 5 minute buffer)
  const expiresAt = new Date(user.canva_token_expires_at);
  const now = new Date();
  const bufferTime = 5 * 60 * 1000; // 5 minutes

  if (now.getTime() < expiresAt.getTime() - bufferTime) {
    // Token is still valid
    return user.canva_access_token;
  }

  // Token expired or expiring soon, refresh it
  if (!user.canva_refresh_token) {
    throw new Error('Refresh token not available');
  }

  log.info('Refreshing Canva token', { userId });
  const newTokens = await refreshCanvaToken(userId, user.canva_refresh_token);
  await saveCanvaTokens(userId, newTokens);

  return newTokens.accessToken;
}

/**
 * Refresh access token using refresh token
 */
async function refreshCanvaToken(
  userId: string,
  refreshToken: string
): Promise<CanvaOAuthTokens> {
  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Canva OAuth credentials not configured');
  }

  try {
    const response = await fetch(CANVA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt,
      userId,
      scopes: data.scope?.split(' ') || CANVA_SCOPES,
    };
  } catch (error) {
    log.error('Failed to refresh Canva token', error as Error, { userId });
    throw error;
  }
}

/**
 * Revoke Canva access
 */
export async function revokeCanvaAccess(userId: string): Promise<void> {
  log.info('Revoking Canva access', { userId });

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('users')
    .update({
      canva_access_token: null,
      canva_refresh_token: null,
      canva_token_expires_at: null,
      canva_user_id: null,
      canva_scopes: null,
      canva_connected_at: null,
    })
    .eq('id', userId);

  if (error) {
    log.error('Failed to revoke Canva access', error as Error, { userId });
    throw error;
  }

  log.info('Canva access revoked successfully', { userId });
}

/**
 * Check if user is connected to Canva
 */
export async function isCanvaConnected(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const { data: user, error } = await supabase
    .from('users')
    .select('canva_access_token, canva_token_expires_at')
    .eq('id', userId)
    .single();

  if (error || !user || !user.canva_access_token) {
    return false;
  }

  // Check if token is expired
  const expiresAt = new Date(user.canva_token_expires_at);
  const now = new Date();

  return now < expiresAt;
}

/**
 * Get user Canva info
 */
export async function getUserCanvaInfo(userId: string): Promise<{
  connected: boolean;
  userId?: string;
  connectedAt?: Date;
  scopes?: string[];
} | null> {
  const supabase = getSupabaseAdmin();

  const { data: user, error } = await supabase
    .from('users')
    .select('canva_user_id, canva_connected_at, canva_scopes, canva_access_token')
    .eq('id', userId)
    .single();

  if (error || !user) {
    return null;
  }

  const connected = await isCanvaConnected(userId);

  return {
    connected,
    userId: user.canva_user_id,
    connectedAt: user.canva_connected_at ? new Date(user.canva_connected_at) : undefined,
    scopes: user.canva_scopes,
  };
}
