/**
 * POST /api/agents/:id/run
 * Run a specific agent directly
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { getAgentRegistry } from '@/lib/backend/execution/agent-registry';
import { classifyIntent } from '@/lib/backend/control/intent-classifier';
import { v4 as uuidv4 } from 'uuid';
import type { Job } from '@/lib/backend/types/job.types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return requireAuth(request, async (req, user) => {
    try {
      const { id } = await params;
      const body = await request.json();
      const { input, clientId } = body;

      if (!input || typeof input !== 'string' || input.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Input is required',
          },
          { status: 400 }
        );
      }

      console.log('Running agent directly', { agentId: id, input: input.slice(0, 100) });

      const registry = getAgentRegistry();
      const agent = registry.get(id);

      if (!agent) {
        return NextResponse.json(
          {
            success: false,
            error: 'Agent not found',
          },
          { status: 404 }
        );
      }

      // Classify intent for context
      const intent = await classifyIntent(input);

      // Create minimal job for agent execution
      const job: Job = {
        id: uuidv4(),
        status: 'running',
        rawInput: input,
        intent,
        userId: user.userId,
        clientId,
        knowledgePack: {
          jobId: uuidv4(),
          ready: true, // Skip knowledge retrieval for direct execution
          documents: [],
          chunks: [],
          missing: [],
          searchQuery: input,
          confidence: 0.5,
          retrievedAt: new Date(),
          status: 'retrieved',
        },
        assignedAgent: agent.id,
        subJobs: [],
        state: {
          decisions: [],
          assumptions: [],
          unresolvedQuestions: [],
          custom: {},
        },
        memory: [],
        retryCount: 0,
        maxRetries: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Execute agent
      const result = await agent.execute(job);

      return NextResponse.json({
        success: result.success,
        agentId: agent.id,
        agentName: agent.nameHebrew,
        output: result.output,
        structured: result.structured,
        confidence: result.confidence,
        citations: result.citations,
      });
    } catch (error) {
      console.error('Agent execution failed:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Agent execution failed',
          message: (error as Error).message,
        },
        { status: 500 }
      );
    }
  });
}
