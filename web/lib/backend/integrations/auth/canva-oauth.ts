/**
 * Canva OAuth Integration - Serverless Version
 */

import { createClient } from '@supabase/supabase-js';

const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }
  
  return createClient(supabaseUrl, supabaseKey);
};

export function initiateCanvaOAuthFlow(userId: string): string {
  const clientId = process.env.CANVA_CLIENT_ID;
  const redirectUri = process.env.CANVA_REDIRECT_URI || 'http://localhost:3000/api/auth/canva/callback';
  
  if (!clientId) {
    throw new Error('Missing Canva Client ID');
  }
  
  const authUrl = `https://www.canva.com/api/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=asset:read asset:write design:content:read design:content:write design:meta:read profile:read&state=${userId}`;
  
  return authUrl;
}

export async function handleCanvaOAuthCallback(code: string) {
  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET || process.env.CANVE_CLIENT_SECRET;
  const redirectUri = process.env.CANVA_REDIRECT_URI || 'http://localhost:3000/api/auth/canva/callback';
  
  if (!clientId || !clientSecret) {
    throw new Error('Missing Canva credentials');
  }
  
  const response = await fetch('https://api.canva.com/rest/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to exchange Canva code for tokens');
  }
  
  const tokens = await response.json();
  return { tokens };
}

export async function saveCanvaTokens(userId: string, tokens: any): Promise<void> {
  const supabase = getSupabase();
  
  await supabase
    .from('users')
    .update({
      canva_access_token: tokens.access_token,
      canva_refresh_token: tokens.refresh_token,
      canva_token_expiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
    })
    .eq('id', userId);
}

export async function getUserCanvaInfo(userId: string) {
  const supabase = getSupabase();
  
  const { data: user } = await supabase
    .from('users')
    .select('canva_access_token, canva_refresh_token, email')
    .eq('id', userId)
    .single();
  
  if (!user || !user.canva_access_token) {
    return {
      connected: false,
    };
  }
  
  return {
    connected: true,
    hasRefreshToken: !!user.canva_refresh_token,
  };
}
