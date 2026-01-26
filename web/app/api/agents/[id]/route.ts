/**
 * GET /api/agents/:id
 * Get agent by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgentRegistry } from '@backend/execution/agent-registry';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        nameHebrew: agent.nameHebrew,
        domain: agent.domain,
        description: agent.description,
        capabilities: agent.capabilities,
        layer: agent.layer,
      },
    });
  } catch (error) {
    console.error('Failed to get agent:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get agent',
      },
      { status: 500 }
    );
  }
}
