/**
 * System Status API
 * Get orchestration system status
 */

import { NextResponse } from 'next/server';
import { getSystemStatus } from '@/lib/backend/orchestration/initialize';

export async function GET() {
  try {
    const status = await getSystemStatus();

    return NextResponse.json({
      status: 'ok',
      system: status
    });
  } catch (error) {
    console.error('Status API error:', error);
    
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
