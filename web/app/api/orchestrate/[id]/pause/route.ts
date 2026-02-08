/**
 * Pause Execution API
 */

import { NextRequest, NextResponse } from 'next/server';
import { masterOrchestrator } from '@/lib/backend/orchestration/master-orchestrator';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const executionId = params.id;
    
    await masterOrchestrator.pause(executionId);

    return NextResponse.json({
      success: true,
      message: 'Execution paused'
    });
  } catch (error) {
    console.error('Pause execution error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to pause execution',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
