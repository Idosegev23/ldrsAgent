/**
 * DEBUG /api/debug/env
 * Check which env vars are available (Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  return requireAdmin(request, async () => {
    const envKeys = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_SERVICE_ACCOUNT_KEY',
      'GOOGLE_DRIVE_FOLDER_ID',
      'CLICKUP_API_TOKEN',
      'CLICKUP_WORKSPACE_ID',
      'GREEN_API_INSTANCE_ID',
      'GREEN_API_TOKEN',
      'APIFY_TOKEN',
      'OPENAI_API_KEY',
      'GEMINI_API_KEY',
    ];

    const envStatus = envKeys.reduce((acc, key) => {
      const value = process.env[key];
      acc[key] = {
        exists: !!value,
        length: value?.length || 0,
        preview: value ? `${value.substring(0, 15)}...` : null,
      };
      return acc;
    }, {} as Record<string, any>);

    return NextResponse.json({
      success: true,
      env: envStatus,
      nodeEnv: process.env.NODE_ENV,
    });
  });
}
