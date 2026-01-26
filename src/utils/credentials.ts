/**
 * Credentials Service
 * Fetches system credentials from Supabase with caching
 */

import { getSupabaseAdmin } from '../db/client.js';
import { logger } from './logger.js';

const log = logger.child({ component: 'CredentialsService' });

interface CachedCredential {
  value: string;
  expiresAt: number;
}

// Cache credentials in memory
const credentialsCache = new Map<string, CachedCredential>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get a credential from Supabase (with caching)
 */
export async function getCredential(key: string): Promise<string> {
  // Check cache first
  const cached = credentialsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    log.debug('Credential found in cache', { key });
    return cached.value;
  }

  log.debug('Fetching credential from Supabase', { key });

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('system_credentials')
      .select('value')
      .eq('key', key)
      .single();

    if (error || !data) {
      throw new Error(`Credential not found: ${key}`);
    }

    // Cache it
    credentialsCache.set(key, {
      value: data.value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    log.debug('Credential cached', { key });
    return data.value;
  } catch (error) {
    log.error('Failed to fetch credential', error as Error, { key });
    throw error;
  }
}

/**
 * Get all Google OAuth credentials at once
 */
export async function getGoogleOAuthCredentials() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const redirectUriKey = nodeEnv === 'production' ? 'GOOGLE_REDIRECT_URI_PROD' : 'GOOGLE_REDIRECT_URI';

  const [clientId, clientSecret, redirectUri] = await Promise.all([
    getCredential('GOOGLE_CLIENT_ID'),
    getCredential('GOOGLE_CLIENT_SECRET'),
    getCredential(redirectUriKey),
  ]);

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

/**
 * Clear credentials cache (useful for testing or forcing refresh)
 */
export function clearCredentialsCache(): void {
  credentialsCache.clear();
  log.info('Credentials cache cleared');
}

/**
 * Preload commonly used credentials
 */
export async function preloadCredentials(): Promise<void> {
  try {
    await getGoogleOAuthCredentials();
    log.info('Credentials preloaded successfully');
  } catch (error) {
    log.warn('Failed to preload credentials', error as Error);
  }
}
