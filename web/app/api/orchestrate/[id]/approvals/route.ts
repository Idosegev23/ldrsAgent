/**
 * Approvals API
 * Get pending approvals for execution
 */

import { NextRequest, NextResponse } from 'next/server';
import { hitlGate } from '@backend/orchestration/safety/hitl-gates';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const executionId = params.id;
    
    const approvals = await hitlGate.getPendingApprovals(executionId);

    return NextResponse.json({
      approvals
    });
  } catch (error) {
    console.error('Approvals API error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to fetch approvals',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
