/**
 * Next.js Middleware
 * Serverless mode - no initialization needed
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Serverless mode - stateless, no initialization required
  return NextResponse.next();
}

export const config = {
  matcher: '/api/orchestrate/:path*'
};
