/**
 * Canva OAuth Callback API
 * Handle OAuth redirect and save tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleCanvaOAuthCallback, saveCanvaTokens } from '@/lib/backend/integrations/auth/canva-oauth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // userId passed as state
    
    if (!code) {
      return NextResponse.redirect(
        new URL('/dashboard?canva_error=no_code', request.url)
      );
    }

    if (!state) {
      return NextResponse.redirect(
        new URL('/dashboard?canva_error=no_user_id', request.url)
      );
    }

    // Exchange code for tokens
    const tokens = await handleCanvaOAuthCallback(code, state);
    
    // Save tokens to database
    await saveCanvaTokens(state, tokens);
    
    return NextResponse.redirect(
      new URL('/dashboard?canva=connected', request.url)
    );
  } catch (error) {
    console.error('Canva OAuth callback failed:', error);
    
    return NextResponse.redirect(
      new URL(
        `/dashboard?canva_error=${encodeURIComponent(error instanceof Error ? error.message : 'unknown')}`,
        request.url
      )
    );
  }
}
