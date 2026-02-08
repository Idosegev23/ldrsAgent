/**
 * Orchestration Execution API
 * Get execution status
 */

import { NextRequest, NextResponse } from 'next/server';
import { masterOrchestrator } from '@/lib/backend/orchestration/master-orchestrator';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const executionId = params.id;
    
    const execution = await masterOrchestrator.getExecution(executionId);

    if (!execution) {
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      execution: {
        id: execution.id,
        status: execution.status,
        request: execution.request,
        plan: execution.plan,
        currentStep: execution.currentStep,
        totalSteps: execution.totalSteps,
        result: execution.result,
        error: execution.error,
        createdAt: execution.createdAt,
        updatedAt: execution.updatedAt,
        completedAt: execution.completedAt
      }
    });
  } catch (error) {
    console.error('Execution API error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to fetch execution',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
