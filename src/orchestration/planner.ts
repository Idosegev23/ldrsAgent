/**
 * LLM-based Planner
 * Creates execution plans from natural language requests
 */

import type {
  ExecutionPlan,
  ExecutionStep,
  DependencyGraph,
  StepInput
} from '../types/orchestration.types.js';
import type { ExecutionContext } from '../types/execution.types.js';
import { GoogleGenAI } from '@google/genai';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class Planner {
  private llm: GoogleGenAI;

  constructor() {
    this.llm = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
  }

  /**
   * Create execution plan from user request
   */
  async createPlan(
    request: string,
    userId: string,
    context: ExecutionContext
  ): Promise<ExecutionPlan> {
    logger.info('Creating execution plan', {
      executionId: context.executionId,
      request: request.substring(0, 100)
    });

    try {
      // Get available agents/tools
      const availableTools = await this.discoverTools();

      // Check if Canva should be enforced
      const canvaKeywords = ['canva', 'קנבה', 'בקנבה', 'ב-canva', 'דיזיין', 'עיצוב', 'מעוצב', 'פרזנטציה', 'מצגת', 'הצעת מחיר רזה', 'הצעת מחיר מעוצבת'];
      const shouldUseCanva = canvaKeywords.some(keyword => request.toLowerCase().includes(keyword));

      // Generate plan using LLM
      const prompt = this.buildPlanningPrompt(request, availableTools, shouldUseCanva);
      const response = await this.llm.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.3,
          maxOutputTokens: 4096
        }
      });

      // Parse LLM response into structured plan
      const responseText = response.text || '';
      const planData = this.parsePlanResponse(responseText);

      // Build execution steps
      const steps: ExecutionStep[] = planData.steps.map((stepData: any, index: number) => ({
        id: uuidv4(),
        stepNumber: index + 1,
        agentId: stepData.agentId,
        agentName: stepData.agentName,
        description: stepData.description,
        input: {
          task: stepData.task,
          context: stepData.context || {},
          requirements: stepData.requirements || [],
          constraints: stepData.constraints
        },
        status: 'PENDING',
        dependencies: stepData.dependencies || []
      }));

      // Build dependency graph
      const dependencies = this.buildDependencyGraph(steps);

      const plan: ExecutionPlan = {
        id: uuidv4(),
        executionId: context.executionId,
        steps,
        dependencies,
        estimatedDuration: this.estimateDuration(steps),
        estimatedTokens: this.estimateTokens(steps),
        createdAt: new Date()
      };

      logger.info('Execution plan created', {
        executionId: context.executionId,
        totalSteps: steps.length,
        estimatedDurationMs: plan.estimatedDuration
      });

      return plan;
    } catch (error) {
      logger.error('Failed to create plan', {
        executionId: context.executionId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Build planning prompt
   */
  private buildPlanningPrompt(request: string, availableTools: any[], enforceCanva: boolean = false): string {
    const canvaEnforcementNote = enforceCanva ? `

**⚠️ IMPORTANT REQUIREMENT:**
This request mentions design/visual work or Canva explicitly. You MUST include the "Canva Design Agent" (canva_agent) in your plan.
The user expects professional visual output created in Canva - do NOT use other agents for creating visual/design deliverables.` : '';

    return `You are an AI execution planner. Your task is to break down user requests into a sequence of executable steps using available agents and tools.

**User Request:**
${request}${canvaEnforcementNote}

**Available Agents:**
${availableTools.map(tool => `- ${tool.name} (${tool.id}): ${tool.description}`).join('\n')}

**Instructions:**
1. Analyze the user request and identify the main goals
2. Break down the request into sequential steps
3. For each step, assign the most appropriate agent
4. Identify dependencies between steps
5. Provide clear task descriptions for each step
${enforceCanva ? '6. **CRITICAL:** Use "canva_agent" for any design/visual/presentation work' : ''}

**Output Format (JSON):**
{
  "steps": [
    {
      "agentId": "agent_id",
      "agentName": "Agent Name",
      "description": "What this step does",
      "task": "Specific task for the agent",
      "context": {"key": "value"},
      "requirements": ["requirement1", "requirement2"],
      "dependencies": [] // step numbers that must complete first
    }
  ]
}

Generate the execution plan now:`;
  }

  /**
   * Parse LLM response into plan data
   */
  private parsePlanResponse(response: string): any {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                       response.match(/```\n([\s\S]*?)\n```/) ||
                       response.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }

      const jsonText = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonText);
    } catch (error) {
      logger.error('Failed to parse plan response', {
        error: error instanceof Error ? error.message : String(error),
        response
      });
      
      // Fallback: create simple single-step plan
      return {
        steps: [{
          agentId: 'assistant',
          agentName: 'General Assistant',
          description: 'Process user request',
          task: 'Handle the user request',
          context: {},
          requirements: [],
          dependencies: []
        }]
      };
    }
  }

  /**
   * Build dependency graph
   */
  private buildDependencyGraph(steps: ExecutionStep[]): DependencyGraph {
    const nodes = steps.map(step => step.id);
    const edges = [];

    for (const step of steps) {
      // Convert step number dependencies to step IDs
      for (const depNumber of step.dependencies) {
        const depStepNumber = typeof depNumber === 'number' ? depNumber : parseInt(depNumber);
        const depStep = steps.find(s => s.stepNumber === depStepNumber);
        
        if (depStep) {
          edges.push({
            from: depStep.id,
            to: step.id,
            type: 'sequence' as const
          });
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Discover available tools
   */
  private async discoverTools(): Promise<any[]> {
    // TODO: Implement dynamic tool discovery from agent registry
    // For now, return a basic list
    return [
      {
        id: 'real_execution',
        name: 'Real Execution Agent',
        description: 'Full end-to-end execution: Drive search, AI analysis, Calendar scheduling, Document creation. Use for complex requests requiring data extraction, analysis and action. Supports OAuth for user-specific access.'
      },
      {
        id: 'canva_agent',
        name: 'Canva Design Agent',
        description: '**VISUAL DESIGN CREATION SPECIALIST** - Use this agent for ANY request involving graphic design, visual content, or professional presentations. Capabilities: Create proposals/presentations from Canva templates ("הצעת מחיר", "מצגת", "פרזנטציה"), design social media posts, export to PDF/PNG/JPG, upload brand assets, search existing designs. **ALWAYS use this agent when user mentions: "בקנבה", "ב-Canva", "Canva", "דיזיין", "הצעת מחיר מעוצבת", "מצגת", or any visual/design work.** This is the ONLY agent that can create professional visual outputs. Supports OAuth.'
      },
      {
        id: 'drive-search',
        name: 'Drive Search Agent',
        description: 'Search and retrieve files from Google Drive'
      },
      {
        id: 'weekly-status',
        name: 'Weekly Status Agent',
        description: 'Analyze data and create status reports'
      },
      {
        id: 'editor',
        name: 'Content Editor Agent',
        description: 'Create and edit content, emails, documents'
      },
      {
        id: 'calendar',
        name: 'Calendar Agent',
        description: 'Schedule meetings and manage calendar events'
      },
      {
        id: 'contacts',
        name: 'Contact Search Agent',
        description: 'Find contact information and email addresses'
      },
      {
        id: 'assistant',
        name: 'General Assistant',
        description: 'General purpose assistant for various tasks'
      }
    ];
  }

  /**
   * Estimate execution duration
   */
  private estimateDuration(steps: ExecutionStep[]): number {
    // Basic estimation: 30 seconds per step
    return steps.length * 30000;
  }

  /**
   * Estimate token usage
   */
  private estimateTokens(steps: ExecutionStep[]): number {
    // Basic estimation: 2000 tokens per step
    return steps.length * 2000;
  }

  /**
   * Optimize plan
   */
  async optimizePlan(plan: ExecutionPlan): Promise<ExecutionPlan> {
    // TODO: Implement plan optimization
    // - Identify parallel execution opportunities
    // - Remove redundant steps
    // - Merge similar steps
    return plan;
  }

  /**
   * Validate plan
   */
  async validatePlan(plan: ExecutionPlan): Promise<boolean> {
    // Check for circular dependencies
    if (this.hasCircularDependencies(plan.dependencies)) {
      throw new Error('Plan contains circular dependencies');
    }

    // Check for invalid agent references
    const validAgentIds = ['drive-search', 'weekly-status', 'editor', 'calendar', 'contacts', 'assistant'];
    for (const step of plan.steps) {
      if (!validAgentIds.includes(step.agentId)) {
        logger.warn('Unknown agent ID in plan', { agentId: step.agentId });
      }
    }

    return true;
  }

  /**
   * Check for circular dependencies
   */
  private hasCircularDependencies(graph: DependencyGraph): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);

      // Get outgoing edges
      const outgoing = graph.edges.filter(e => e.from === node);
      
      for (const edge of outgoing) {
        if (!visited.has(edge.to)) {
          if (hasCycle(edge.to)) {
            return true;
          }
        } else if (recStack.has(edge.to)) {
          return true;
        }
      }

      recStack.delete(node);
      return false;
    };

    for (const node of graph.nodes) {
      if (!visited.has(node)) {
        if (hasCycle(node)) {
          return true;
        }
      }
    }

    return false;
  }
}
