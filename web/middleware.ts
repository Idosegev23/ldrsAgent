/**
 * Next.js Middleware
 * Initialize orchestration on first request
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

let initPromise: Promise<void> | null = null;

export async function middleware(request: NextRequest) {
  // Initialize orchestration system on first request
  if (!initPromise && request.nextUrl.pathname.startsWith('/api/orchestrate')) {
    initPromise = (async () => {
      try {
        const { initializeOrchestration } = await import('@backend/orchestration/initialize');
        await initializeOrchestration();
      } catch (error) {
        console.error('Failed to initialize orchestration:', error);
      }
    })();
  }

  // Wait for initialization
  if (initPromise) {
    await initPromise;
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/orchestrate/:path*'
};
