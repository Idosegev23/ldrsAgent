/**
 * Agent Types
 * Agent interfaces and intent classification
 */

import type { Job, AgentResult } from './job.types.js';

export type IntentType =
  // Proposals
  | 'generate_proposal'
  | 'create_quote'
  | 'annual_strategy'
  // Research
  | 'research_brand'
  | 'prepare_meeting'
  | 'competitor_analysis'
  | 'deep_research'
  // Media
  | 'media_strategy'
  | 'media_performance'
  | 'media_deliverables'
  // Sales
  | 'sales_tracking'
  | 'sales_followup'
  | 'sales_email'
  | 'customer_satisfaction'
  // Influencers
  | 'influencer_research'
  | 'influencer_concept'
  | 'influencer_kpi'
  // HR
  | 'hr_satisfaction'
  | 'hr_feedback'
  // Creative
  | 'creative_ideas'
  | 'brand_brain'
  | 'creative_format'
  // Production
  | 'production_deck'
  | 'supplier_match'
  | 'budget_check'
  // Operations
  | 'meeting_summary'
  | 'weekly_status'
  | 'bottleneck_detection'
  // Finance
  | 'billing_control'
  | 'cashflow'
  // Calendar
  | 'calendar_query'
  | 'calendar_create'
  // General
  | 'general_question'
  | 'clarification_needed'
  | 'unknown';

export interface Intent {
  primary: IntentType;
  secondary?: IntentType;
  entities: IntentEntities;
  confidence: number;
}

export interface IntentEntities {
  clientName?: string;
  domain?: string;
  action?: string;
  timeframe?: string;
  budget?: number;
  custom: Record<string, string>;
}

export type AgentLayer = 0 | 1 | 2;

export interface IAgent {
  id: string;
  name: string;
  nameHebrew: string;
  layer: AgentLayer;
  domain: string;
  capabilities: string[];
  description: string;

  // Core execution
  execute(job: Job): Promise<AgentResult>;

  // Can this agent handle the job?
  canHandle(intent: Intent): boolean;

  // Get confidence for handling this intent
  getConfidence(intent: Intent): number;
}

export interface RoutingRule {
  intent: IntentType;
  agent: string;
  requiresKnowledge: boolean;
  knowledgeQuery?: string;
  confidenceThreshold: number;
  integrations?: string[];
  fallbackAgent?: string;
}

export interface AgentRegistry {
  agents: Map<string, IAgent>;
  
  register(agent: IAgent): void;
  get(id: string): IAgent | undefined;
  findByIntent(intent: Intent): IAgent | undefined;
  getAll(): IAgent[];
}

// LLM Provider interface
export type LLMRole = 'reasoning' | 'writing';

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  role?: LLMRole;
}

export interface ILLMProvider {
  name: 'gemini' | 'openai';
  model: string;
  role: LLMRole;

  complete(prompt: string, options?: LLMOptions): Promise<string>;
  chat(messages: ChatMessage[], options?: LLMOptions): Promise<string>;
  
  // Structured output
  generateStructured<T>(
    prompt: string,
    schema: object,
    options?: LLMOptions
  ): Promise<T>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

