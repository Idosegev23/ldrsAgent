/**
 * Google OAuth Integration - Serverless Version
 * Handles Google authentication for Gmail, Calendar, Drive
 */

import { createClient } from '@supabase/supabase-js';

const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }
  
  return createClient(supabaseUrl, supabaseKey);
};

function buildAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: OAUTH_SCOPES.join(' '),
    access_type: 'offline',
    state: state,
    prompt: 'consent',
  });
  
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function initiateOAuthFlow(userId: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';
  
  if (!clientId) {
    throw new Error('Missing Google OAuth credentials');
  }
  
  return buildAuthUrl(clientId, redirectUri, userId);
}

export async function handleOAuthCallback(code: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';
  
  if (!clientId || !clientSecret) {
    throw new Error('Missing Google OAuth credentials');
  }
  
  // Exchange code for tokens using Google's token endpoint
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to exchange code for tokens');
  }
  
  const tokens = await response.json();
  return { tokens };
}

export async function saveUserTokens(userId: string, tokens: any): Promise<void> {
  const supabase = getSupabase();
  
  await supabase
    .from('users')
    .update({
      google_access_token: tokens.access_token,
      google_refresh_token: tokens.refresh_token,
      google_token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    })
    .eq('id', userId);
}

export async function getUserGoogleInfo(userId: string) {
  const supabase = getSupabase();
  
  const { data: user } = await supabase
    .from('users')
    .select('google_access_token, google_refresh_token, google_token_expiry, email')
    .eq('id', userId)
    .single();
  
  if (!user || !user.google_access_token) {
    return {
      connected: false,
      email: null,
    };
  }
  
  return {
    connected: true,
    email: user.email,
    hasRefreshToken: !!user.google_refresh_token,
  };
}
