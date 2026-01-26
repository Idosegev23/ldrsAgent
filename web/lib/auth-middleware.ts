/**
 * Auth Middleware for Next.js API Routes
 * Validates Supabase sessions and handles RBAC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface AuthUser {
  userId: string;
  email: string;
  role: 'admin' | 'user';
  metadata?: any;
}

export interface AuthError {
  error: string;
  code: string;
}

/**
 * Get authenticated user from request
 * Returns null if not authenticated
 */
export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    // Get Authorization header
    const authHeader = request.headers.get('authorization');
    
    // Only log on errors, not on every request
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);

    // Create Supabase client with custom fetch timeout
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        fetch: (url, options = {}) => {
          return fetch(url, {
            ...options,
            signal: AbortSignal.timeout(15000), // 15 second timeout
          });
        },
      },
    });

    // Verify token and get user
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      // Only log auth failures, not on every request
      return null;
    }

    // Check domain restriction
    const allowedDomain = process.env.ALLOWED_DOMAIN || 'ldrsgroup.com';
    const emailDomain = user.email?.split('@')[1];
    
    if (emailDomain !== allowedDomain) {
      // Only log domain errors (rare)
      console.warn('[Auth] Domain denied:', emailDomain);
      return null;
    }

    // Get user role from database
    const role = await getUserRole(user.id, user.email!);

    return {
      userId: user.id,
      email: user.email!,
      role,
      metadata: user.user_metadata,
    };
  } catch (error: any) {
    console.error('Auth middleware error:', error);
    
    // If it's a timeout, log it specifically
    if (error.code === 'UND_ERR_CONNECT_TIMEOUT' || error.message?.includes('timeout')) {
      console.error('[Auth Middleware] Supabase timeout - this might be a network issue');
    }
    
    return null;
  }
}

/**
 * Get user role from Supabase
 */
async function getUserRole(userId: string, email: string): Promise<'admin' | 'user'> {
  // Admin emails
  const adminEmails = ['cto@ldrsgroup.com', 'yoav@ldrsgroup.com'];
  
  if (adminEmails.includes(email.toLowerCase())) {
    return 'admin';
  }

  // Query database for role
  try {
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseServiceKey) {
      console.warn('SUPABASE_SERVICE_ROLE_KEY not set, using email-based role');
      return 'user';
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return 'user';
    }

    return data.role === 'admin' ? 'admin' : 'user';
  } catch (error) {
    console.error('Error getting user role:', error);
    return 'user';
  }
}

/**
 * Require authentication middleware
 * Returns 401 if not authenticated
 */
export async function requireAuth(
  request: NextRequest,
  handler: (request: NextRequest, user: AuthUser) => Promise<NextResponse>
): Promise<NextResponse> {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      },
      { status: 401 }
    );
  }

  return handler(request, user);
}

/**
 * Require admin middleware
 * Returns 403 if not admin
 */
export async function requireAdmin(
  request: NextRequest,
  handler: (request: NextRequest, user: AuthUser) => Promise<NextResponse>
): Promise<NextResponse> {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      },
      { status: 401 }
    );
  }

  if (user.role !== 'admin') {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Admin access required',
        code: 'ADMIN_REQUIRED'
      },
      { status: 403 }
    );
  }

  return handler(request, user);
}
