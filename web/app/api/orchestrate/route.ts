/**
 * Orchestration API
 * Main endpoint for starting executions
 */

import { NextRequest, NextResponse } from 'next/server';
import { masterOrchestrator } from '@backend/orchestration/master-orchestrator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, userId } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Start execution
    const execution = await masterOrchestrator.start(query, userId);

    return NextResponse.json({
      execution: {
        id: execution.id,
        status: execution.status,
        request: execution.request,
        currentStep: execution.currentStep,
        totalSteps: execution.totalSteps,
        createdAt: execution.createdAt
      }
    });
  } catch (error) {
    console.error('Orchestration API error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to start execution',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // TODO: Get user's executions from database

    return NextResponse.json({
      executions: []
    });
  } catch (error) {
    console.error('Orchestration API error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to fetch executions',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
