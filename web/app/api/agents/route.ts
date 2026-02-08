/**
 * GET /api/agents
 * List all available agents
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgentRegistry } from '@/lib/backend/execution/agent-registry';
import '@/lib/startup'; // Initialize backend on first API call

export async function GET(request: NextRequest) {
  try {
    const registry = getAgentRegistry();
    const agents = registry.getAll();

    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    const capability = searchParams.get('capability');

    let filteredAgents = agents;

    // Filter by domain
    if (domain) {
      filteredAgents = registry.getByDomain(domain);
    }

    // Filter by capability
    if (capability) {
      filteredAgents = filteredAgents.filter(agent =>
        agent.capabilities.some(cap => 
          cap.toLowerCase().includes(capability.toLowerCase())
        )
      );
    }

    return NextResponse.json({
      success: true,
      agents: filteredAgents.map(agent => ({
        id: agent.id,
        name: agent.name,
        nameHebrew: agent.nameHebrew,
        domain: agent.domain,
        description: agent.description,
        capabilities: agent.capabilities,
        layer: agent.layer,
      })),
      count: filteredAgents.length,
    });
  } catch (error) {
    console.error('Failed to get agents:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get agents',
      },
      { status: 500 }
    );
  }
}
