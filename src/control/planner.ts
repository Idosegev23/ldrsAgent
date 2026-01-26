/**
 * Planner
 * Determines routing based on intent
 */

import { logger } from '../utils/logger.js';
import type { Intent, IntentType, RoutingRule } from '../types/agent.types.js';

const log = logger.child({ component: 'Planner' });

// Routing rules
const ROUTING_RULES: RoutingRule[] = [
  {
    intent: 'media_strategy',
    agent: 'media/strategy',
    requiresKnowledge: true,
    knowledgeQuery: 'client:{clientName} briefs strategy media',
    confidenceThreshold: 0.6,
    integrations: ['drive'],
  },
  {
    intent: 'media_performance',
    agent: 'media/strategy',
    requiresKnowledge: true,
    knowledgeQuery: 'client:{clientName} campaigns performance metrics',
    confidenceThreshold: 0.6,
  },
  {
    intent: 'sales_tracking',
    agent: 'sales/tracker',
    requiresKnowledge: true,
    knowledgeQuery: 'client:{clientName} deals pipeline',
    confidenceThreshold: 0.6,
    integrations: ['clickup'],
  },
  {
    intent: 'sales_followup',
    agent: 'sales/followup',
    requiresKnowledge: true,
    knowledgeQuery: 'client:{clientName} communications history',
    confidenceThreshold: 0.6,
    integrations: ['gmail'],
  },
  {
    intent: 'sales_email',
    agent: 'sales/email-writer',
    requiresKnowledge: true,
    knowledgeQuery: 'client:{clientName} context tone',
    confidenceThreshold: 0.6,
  },
  {
    intent: 'influencer_research',
    agent: 'influencers/research',
    requiresKnowledge: true,
    knowledgeQuery: 'client:{clientName} brand target audience',
    confidenceThreshold: 0.6,
  },
  {
    intent: 'influencer_concept',
    agent: 'influencers/concept',
    requiresKnowledge: true,
    knowledgeQuery: 'client:{clientName} brand values campaign goals',
    confidenceThreshold: 0.6,
  },
  {
    intent: 'hr_satisfaction',
    agent: 'hr/satisfaction',
    requiresKnowledge: true,
    knowledgeQuery: 'employee surveys feedback',
    confidenceThreshold: 0.6,
  },
  {
    intent: 'hr_feedback',
    agent: 'hr/feedback',
    requiresKnowledge: true,
    knowledgeQuery: 'employee {clientName} performance',
    confidenceThreshold: 0.6,
  },
  {
    intent: 'calendar_query',
    agent: 'calendar/calendar',
    requiresKnowledge: false,
    confidenceThreshold: 0.6,
    integrations: ['calendar'],
  },
  {
    intent: 'calendar_create',
    agent: 'calendar/calendar',
    requiresKnowledge: false,
    confidenceThreshold: 0.6,
    integrations: ['calendar'],
  },
  {
    intent: 'generate_proposal',
    agent: 'proposals/proposal',
    requiresKnowledge: true,
    knowledgeQuery: 'client:{clientName} brand research templates',
    confidenceThreshold: 0.6,
    integrations: ['drive'],
  },
  {
    intent: 'general_question',
    agent: 'general/assistant',
    requiresKnowledge: true,
    knowledgeQuery: '{rawInput}',
    confidenceThreshold: 0.4,
  },
];

export interface RoutingPlan {
  agent: string;
  requiresKnowledge: boolean;
  knowledgeQuery: string;
  integrations: string[];
  belowThreshold: boolean;
}

/**
 * Create routing plan based on intent
 */
export function createRoutingPlan(intent: Intent, rawInput: string): RoutingPlan {
  log.debug('Creating routing plan', { intent: intent.primary });

  const rule = ROUTING_RULES.find((r) => r.intent === intent.primary);

  if (!rule) {
    log.warn('No routing rule found', { intent: intent.primary });
    return {
      agent: 'general/assistant',
      requiresKnowledge: true,
      knowledgeQuery: rawInput,
      integrations: [],
      belowThreshold: true,
    };
  }

  // Check if confidence is below threshold
  const belowThreshold = intent.confidence < rule.confidenceThreshold;

  // Build knowledge query with entity substitution
  let knowledgeQuery = rule.knowledgeQuery || '';
  if (intent.entities.clientName) {
    knowledgeQuery = knowledgeQuery.replace('{clientName}', intent.entities.clientName);
  }
  knowledgeQuery = knowledgeQuery.replace('{rawInput}', rawInput);

  const plan: RoutingPlan = {
    agent: rule.agent,
    requiresKnowledge: rule.requiresKnowledge,
    knowledgeQuery,
    integrations: rule.integrations || [],
    belowThreshold,
  };

  log.info('Routing plan created', {
    agent: plan.agent,
    requiresKnowledge: plan.requiresKnowledge,
    belowThreshold: plan.belowThreshold,
  });

  return plan;
}

/**
 * Get all available routes
 */
export function getAvailableRoutes(): RoutingRule[] {
  return ROUTING_RULES;
}

/**
 * Check if an agent exists for an intent
 */
export function hasAgentForIntent(intent: IntentType): boolean {
  return ROUTING_RULES.some((r) => r.intent === intent);
}

