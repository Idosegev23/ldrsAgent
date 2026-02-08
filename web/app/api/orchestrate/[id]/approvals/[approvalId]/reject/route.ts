/**
 * Reject Action API
 */

import { NextRequest, NextResponse } from 'next/server';
import { hitlGate } from '@/lib/backend/orchestration/safety/hitl-gates';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; approvalId: string } }
) {
  try {
    const { approvalId } = params;
    const body = await request.json().catch(() => ({}));
    const resolvedBy = body.userId || 'system';

    await hitlGate.reject(approvalId, resolvedBy);

    return NextResponse.json({
      success: true,
      message: 'Approval rejected'
    });
  } catch (error) {
    console.error('Reject action error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to reject',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
