/**
 * Approve Action API
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

    await hitlGate.approve(approvalId, resolvedBy);

    return NextResponse.json({
      success: true,
      message: 'Approval granted'
    });
  } catch (error) {
    console.error('Approve action error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to approve',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
