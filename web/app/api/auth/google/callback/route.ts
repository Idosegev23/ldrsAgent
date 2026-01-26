/**
 * Google OAuth Callback API
 * Handle OAuth redirect and save tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleOAuthCallback, saveUserTokens } from '@backend/integrations/auth/google-oauth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // userId passed as state
    
    if (!code) {
      return NextResponse.redirect(
        new URL('/orchestrate?error=no_code', request.url)
      );
    }

    // Exchange code for tokens
    const { tokens } = await handleOAuthCallback(code);
    
    // Save tokens to database
    // Use state as userId if provided, otherwise we need to get it from session
    if (state) {
      await saveUserTokens(state, tokens);
    } else {
      // Fallback: redirect to get userId from session
      return NextResponse.redirect(
        new URL('/orchestrate?error=no_user_id', request.url)
      );
    }
    
    return NextResponse.redirect(
      new URL('/orchestrate?connected=true', request.url)
    );
  } catch (error) {
    console.error('OAuth callback failed:', error);
    
    return NextResponse.redirect(
      new URL(
        `/orchestrate?error=${encodeURIComponent(error instanceof Error ? error.message : 'unknown')}`,
        request.url
      )
    );
  }
}
