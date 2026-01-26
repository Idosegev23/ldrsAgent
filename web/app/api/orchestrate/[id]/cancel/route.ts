/**
 * Cancel Execution API
 */

import { NextRequest, NextResponse } from 'next/server';
import { masterOrchestrator } from '@backend/orchestration/master-orchestrator';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const executionId = params.id;
    
    await masterOrchestrator.cancel(executionId);

    return NextResponse.json({
      success: true,
      message: 'Execution cancelled'
    });
  } catch (error) {
    console.error('Cancel execution error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to cancel execution',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
