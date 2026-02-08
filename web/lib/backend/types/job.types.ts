/**
 * Job Types
 * Core job structure - the heart of the system
 */

import type { Intent } from './agent.types.js';
import type { KnowledgePack } from './knowledge.types.js';

export type JobStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'failed'
  | 'fix_required'
  | 'needs_human_review'
  | 'blocked'; // Waiting for subjob

export interface Job {
  id: string;
  status: JobStatus;

  // Input
  rawInput: string;
  intent: Intent;
  userId: string;
  clientId?: string;

  // Knowledge
  knowledgePack: KnowledgePack;

  // Execution
  assignedAgent: string;
  subJobs: string[];
  parentJobId?: string;

  // State (includes memory/context)
  state: JobState;
  memory: Message[];

  // Output
  result?: AgentResult;
  validationResult?: ValidationResult;

  // Meta
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface JobState {
  // Memory/Context Plane
  decisions: Decision[];
  assumptions: string[];
  unresolvedQuestions: string[];
  
  // Custom state per agent
  custom: Record<string, unknown>;
}

export interface Decision {
  made: string;
  reason: string;
  timestamp: Date;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'agent';
  content: string;
  agentId?: string;
  timestamp: Date;
}

export interface AgentResult {
  success: boolean;
  output: string;
  structured?: Record<string, unknown>;
  citations: Citation[];
  confidence: 'high' | 'medium' | 'low';
  nextAction: 'done' | 'needs_review' | 'needs_subtask';
  subTaskRequest?: SubTaskRequest;
  pendingAction?: PendingAction;
}

export interface PendingAction {
  id: string;
  type: 'SEND_EMAIL' | 'CREATE_TASK' | 'CREATE_EVENT';
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  preview: {
    title: string;
    description: string;
    recipient?: string;
    recipientEmail?: string;
  };
  parameters: {
    to?: string[];
    subject?: string;
    body?: string;
    taskName?: string;
    eventTitle?: string;
    [key: string]: any;
  };
  jobId: string;
  userId: string;
  createdAt: Date;
  executedAt?: Date;
}

export interface Citation {
  source: string;
  content: string;
  documentId: string;
}

export interface SubTaskRequest {
  targetAgent: string;
  task: string;
  context: Record<string, unknown>;
  blocking: boolean; // If true, parent job waits
}

export interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
  overallScore: number;
  feedback?: string;
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  score: number;
  details?: string;
}

// Job creation input
export interface CreateJobInput {
  rawInput: string;
  userId: string;
  clientId?: string;
  parentJobId?: string;
}

