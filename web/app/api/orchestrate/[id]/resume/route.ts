/**
 * Resume Execution API
 */

import { NextRequest, NextResponse } from 'next/server';
import { masterOrchestrator } from '@/lib/backend/orchestration/master-orchestrator';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const executionId = params.id;
    
    await masterOrchestrator.resume(executionId);

    return NextResponse.json({
      success: true,
      message: 'Execution resumed'
    });
  } catch (error) {
    console.error('Resume execution error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to resume execution',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
