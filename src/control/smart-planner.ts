/**
 * Smart Planner
 * Uses AI to determine which agents to run for a given request
 * Returns an ordered list of agents to execute sequentially
 */

import { logger } from '../utils/logger.js';
import { GeminiProvider } from '../llm/gemini.provider.js';
import { getAgentRegistry } from '../execution/agent-registry.js';
import type { Intent } from '../types/agent.types.js';

const log = logger.child({ component: 'SmartPlanner' });

export interface AgentPlanItem {
  id: string;
  name: string;
  reason: string;
  dependsOnPrevious: boolean;
}

export interface MultiAgentPlan {
  agents: AgentPlanItem[];
  finalEditorPrompt: string;
  explanation: string;
}

const gemini = new GeminiProvider();

/**
 * Create a multi-agent execution plan using AI
 */
export async function createMultiAgentPlan(
  rawInput: string,
  intent: Intent,
  clientName?: string
): Promise<MultiAgentPlan> {
  log.info('Creating multi-agent plan', { 
    intent: intent.primary, 
    clientName,
    inputLength: rawInput.length 
  });

  // Get all available agents
  const registry = getAgentRegistry();
  const allAgents = registry.getAll();

  // Build agent catalog for the AI
  const agentCatalog = allAgents.map(agent => ({
    id: agent.id,
    name: agent.nameHebrew || agent.name,
    domain: agent.domain,
    description: agent.description,
    capabilities: agent.capabilities,
  }));

  const prompt = `אתה מתכנן משימות חכם במערכת סוכנים.

## הבקשה מהמשתמש:
"${rawInput}"

## מידע שזוהה:
- Intent: ${intent.primary}
- ביטחון: ${Math.round(intent.confidence * 100)}%
- לקוח: ${clientName || 'לא צוין'}

## סוכנים זמינים:
${JSON.stringify(agentCatalog, null, 2)}

## המשימה שלך:
בחר את הסוכנים הרלוונטיים ביותר לביצוע הבקשה.
- בחר 1-4 סוכנים (לא יותר)
- סדר אותם לפי סדר הגיוני - מחקר קודם, אז ניתוח, אז הפקה
- כל סוכן יקבל את הפלט של הקודמים

## פורמט התשובה:
החזר JSON בפורמט הבא:
{
  "agents": [
    {
      "id": "agent/id",
      "name": "שם הסוכן",
      "reason": "למה הסוכן הזה נבחר",
      "dependsOnPrevious": true/false
    }
  ],
  "finalEditorPrompt": "הנחיות לסוכן העריכה - איך לאחד את התשובות",
  "explanation": "הסבר קצר על התוכנית"
}`;

  try {
    const plan = await gemini.generateStructured<MultiAgentPlan>(prompt, {
      type: 'object',
      properties: {
        agents: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              reason: { type: 'string' },
              dependsOnPrevious: { type: 'boolean' },
            },
          },
        },
        finalEditorPrompt: { type: 'string' },
        explanation: { type: 'string' },
      },
    });

    // Validate agents exist
    const validAgents = plan.agents.filter(agent => {
      const exists = registry.get(agent.id);
      if (!exists) {
        log.warn('Agent from plan not found, skipping', { agentId: agent.id });
      }
      return exists;
    });

    // Ensure at least one agent
    if (validAgents.length === 0) {
      log.warn('No valid agents in plan, using general assistant');
      validAgents.push({
        id: 'general/assistant',
        name: 'עוזר כללי',
        reason: 'fallback - לא נמצאו סוכנים מתאימים',
        dependsOnPrevious: false,
      });
    }

    const finalPlan: MultiAgentPlan = {
      agents: validAgents,
      finalEditorPrompt: plan.finalEditorPrompt || 'אחד את התשובות לתשובה אחת ברורה ומקיפה',
      explanation: plan.explanation || '',
    };

    log.info('Multi-agent plan created', {
      agentCount: finalPlan.agents.length,
      agents: finalPlan.agents.map(a => a.id),
    });

    return finalPlan;
  } catch (error) {
    log.error('Failed to create multi-agent plan', error as Error);
    
    // Fallback to general assistant
    return {
      agents: [{
        id: 'general/assistant',
        name: 'עוזר כללי',
        reason: 'fallback בגלל שגיאה בתכנון',
        dependsOnPrevious: false,
      }],
      finalEditorPrompt: 'ענה על הבקשה בצורה מקיפה',
      explanation: 'תוכנית fallback',
    };
  }
}

/**
 * Get a simple single-agent plan (for backward compatibility)
 */
export function createSingleAgentPlan(agentId: string): MultiAgentPlan {
  const registry = getAgentRegistry();
  const agent = registry.get(agentId);
  
  return {
    agents: [{
      id: agentId,
      name: agent?.nameHebrew || agent?.name || agentId,
      reason: 'נבחר ישירות',
      dependsOnPrevious: false,
    }],
    finalEditorPrompt: '',
    explanation: 'הרצה של סוכן יחיד',
  };
}
