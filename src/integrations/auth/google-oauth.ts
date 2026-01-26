/**
 * Google OAuth Manager
 * Handles OAuth flow, token management, and refresh logic
 */

import { google } from 'googleapis';
import { getSupabaseAdmin } from '../../db/client.js';
import { getGoogleOAuthCredentials } from '../../utils/credentials.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'GoogleOAuth' });

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  email: string;
  scopes: string[];
}

const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

/**
 * Initiate OAuth flow - returns authorization URL
 */
export async function initiateOAuthFlow(userId?: string): Promise<string> {
  log.info('Initiating OAuth flow', { userId });

  const creds = await getGoogleOAuthCredentials();

  const oauth2Client = new google.auth.OAuth2(
    creds.clientId,
    creds.clientSecret,
    creds.redirectUri
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // Force consent screen to get refresh token
    scope: OAUTH_SCOPES,
    state: userId || '', // Pass userId as state
  });

  log.info('OAuth URL generated', { userId });
  return authUrl;
}

/**
 * Handle OAuth callback - exchange code for tokens
 */
export async function handleOAuthCallback(code: string): Promise<{
  tokens: OAuthTokens;
  userId?: string;
}> {
  log.info('Handling OAuth callback');

  const creds = await getGoogleOAuthCredentials();

  const oauth2Client = new google.auth.OAuth2(
    creds.clientId,
    creds.clientSecret,
    creds.redirectUri
  );

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new Error('No access token received');
    }

    // Get user email
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    if (!data.email) {
      throw new Error('No email in user info');
    }

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000); // Default 1 hour

    log.info('OAuth callback successful', { email: data.email });

    return {
      tokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        email: data.email,
        scopes: tokens.scope?.split(' ') || OAUTH_SCOPES,
      },
      userId: undefined, // Will be set by caller if state was passed
    };
  } catch (error) {
    log.error('OAuth callback failed', error as Error);
    throw new Error('Failed to exchange authorization code');
  }
}

/**
 * Save user tokens to database
 */
export async function saveUserTokens(
  userId: string,
  tokens: OAuthTokens
): Promise<void> {
  log.info('Saving user tokens', { userId, email: tokens.email });

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('users')
    .update({
      google_access_token: tokens.accessToken,
      google_refresh_token: tokens.refreshToken,
      google_token_expires_at: tokens.expiresAt.toISOString(),
      google_email: tokens.email,
      google_scopes: tokens.scopes,
      google_connected_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    log.error('Failed to save tokens', error, { userId });
    throw new Error('Failed to save user tokens');
  }

  log.info('Tokens saved successfully', { userId });
}

/**
 * Get valid access token for user (auto-refresh if expired)
 */
export async function getValidToken(userId: string): Promise<string> {
  log.debug('Getting valid token', { userId });

  const supabase = getSupabaseAdmin();

  // Get user's tokens from DB
  const { data: user, error } = await supabase
    .from('users')
    .select('google_access_token, google_refresh_token, google_token_expires_at')
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new Error('User not found or not connected to Google');
  }

  if (!user.google_access_token) {
    throw new Error('User not connected to Google');
  }

  const expiresAt = new Date(user.google_token_expires_at);
  const now = new Date();

  // If token is still valid (with 5 min buffer), return it
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    log.debug('Token still valid', { userId });
    return user.google_access_token;
  }

  // Token expired, need to refresh
  log.info('Token expired, refreshing', { userId });

  if (!user.google_refresh_token) {
    throw new Error('No refresh token available - user needs to reconnect');
  }

  const newAccessToken = await refreshAccessToken(userId, user.google_refresh_token);
  return newAccessToken;
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  userId: string,
  refreshToken: string
): Promise<string> {
  log.info('Refreshing access token', { userId });

  const creds = await getGoogleOAuthCredentials();

  const oauth2Client = new google.auth.OAuth2(
    creds.clientId,
    creds.clientSecret,
    creds.redirectUri
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error('No access token in refresh response');
    }

    const expiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    // Update in DB
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('users')
      .update({
        google_access_token: credentials.access_token,
        google_token_expires_at: expiresAt.toISOString(),
      })
      .eq('id', userId);

    if (error) {
      log.error('Failed to update refreshed token', error, { userId });
      throw new Error('Failed to save refreshed token');
    }

    log.info('Token refreshed successfully', { userId });
    return credentials.access_token;
  } catch (error) {
    log.error('Failed to refresh token', error as Error, { userId });
    throw new Error('Failed to refresh access token - user may need to reconnect');
  }
}

/**
 * Revoke user's Google access
 */
export async function revokeAccess(userId: string): Promise<void> {
  log.info('Revoking Google access', { userId });

  const supabase = getSupabaseAdmin();

  // Get current tokens
  const { data: user } = await supabase
    .from('users')
    .select('google_access_token')
    .eq('id', userId)
    .single();

  // Revoke token with Google (best effort)
  if (user?.google_access_token) {
    try {
      const creds = await getGoogleOAuthCredentials();
      const oauth2Client = new google.auth.OAuth2(
        creds.clientId,
        creds.clientSecret,
        creds.redirectUri
      );
      await oauth2Client.revokeToken(user.google_access_token);
      log.info('Token revoked with Google', { userId });
    } catch (error) {
      log.warn('Failed to revoke token with Google', error as Error, { userId });
      // Continue anyway to clear from DB
    }
  }

  // Clear from DB
  const { error } = await supabase
    .from('users')
    .update({
      google_access_token: null,
      google_refresh_token: null,
      google_token_expires_at: null,
      google_email: null,
      google_scopes: null,
    })
    .eq('id', userId);

  if (error) {
    log.error('Failed to clear tokens from DB', error, { userId });
    throw new Error('Failed to disconnect Google account');
  }

  log.info('Google access revoked', { userId });
}

/**
 * Check if user is connected to Google
 */
export async function isUserConnected(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const { data: user } = await supabase
    .from('users')
    .select('google_access_token, google_refresh_token')
    .eq('id', userId)
    .single();

  return !!(user?.google_access_token && user?.google_refresh_token);
}

/**
 * Get user's Google connection info
 */
export async function getUserGoogleInfo(userId: string): Promise<{
  connected: boolean;
  email?: string;
  connectedAt?: Date;
  scopes?: string[];
} | null> {
  const supabase = getSupabaseAdmin();

  const { data: user, error } = await supabase
    .from('users')
    .select('google_email, google_connected_at, google_scopes, google_access_token')
    .eq('id', userId)
    .single();

  if (error || !user) {
    return null;
  }

  return {
    connected: !!user.google_access_token,
    email: user.google_email || undefined,
    connectedAt: user.google_connected_at ? new Date(user.google_connected_at) : undefined,
    scopes: user.google_scopes || undefined,
  };
}
