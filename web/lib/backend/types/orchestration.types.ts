/**
 * Orchestration Types
 * Types for the autonomous AI orchestration engine
 */

export type ExecutionStatus = 
  | 'PLANNING'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type StepStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED';

export interface Execution {
  id: string;
  userId: string;
  workspaceId?: string;
  request: string;
  plan?: ExecutionPlan;
  status: ExecutionStatus;
  currentStep: number;
  totalSteps: number;
  result?: ExecutionResult;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface ExecutionPlan {
  id: string;
  executionId: string;
  steps: ExecutionStep[];
  dependencies: DependencyGraph;
  estimatedDuration?: number;
  estimatedTokens?: number;
  createdAt: Date;
}

export interface ExecutionStep {
  id: string;
  stepNumber: number;
  agentId: string;
  agentName: string;
  description: string;
  input: StepInput;
  output?: StepOutput;
  status: StepStatus;
  dependencies: string[]; // step IDs
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  tokensUsed?: number;
  error?: string;
}

export interface StepInput {
  task: string;
  context: Record<string, any>;
  requirements: string[];
  constraints?: string[];
}

export interface StepOutput {
  success: boolean;
  data: Record<string, any>;
  summary: string;
  citations?: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface DependencyGraph {
  nodes: string[]; // step IDs
  edges: DependencyEdge[];
}

export interface DependencyEdge {
  from: string; // step ID
  to: string; // step ID
  type: 'data' | 'sequence' | 'optional';
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  structured?: Record<string, any>;
  summary: string;
  steps: StepSummary[];
  totalDurationMs: number;
  totalTokensUsed: number;
}

export interface StepSummary {
  stepNumber: number;
  agentName: string;
  status: StepStatus;
  durationMs?: number;
  tokensUsed?: number;
}

// Context and State
export interface SharedContext {
  executionId: string;
  data: Record<string, ContextValue>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContextValue {
  value: any;
  createdBy: string; // agent ID or step ID
  createdAt: Date;
  expiresAt?: Date;
}

// Checkpoints
export interface ExecutionCheckpoint {
  executionId: string;
  checkpointNumber: number;
  state: ExecutionState;
  context: SharedContext;
  createdAt: Date;
}

export interface ExecutionState {
  currentStep: number;
  completedSteps: string[];
  failedSteps: string[];
  stepResults: Record<string, StepOutput>;
  metadata: Record<string, any>;
}

// Approvals
export interface ApprovalRequest {
  id: string;
  executionId: string;
  stepId: string;
  type: 'CRITICAL_ACTION' | 'AMBIGUITY' | 'BUDGET_ALERT' | 'MANUAL_REVIEW';
  action: ApprovalAction;
  reason: string;
  estimatedImpact?: EstimatedImpact;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface ApprovalAction {
  type: string;
  description: string;
  parameters: Record<string, any>;
  reversible: boolean;
}

export interface EstimatedImpact {
  cost?: number;
  affectedResources?: string[];
  riskLevel: 'low' | 'medium' | 'high';
  description: string;
}

// Patterns and Learning
export interface LearnedPattern {
  id: string;
  patternType: 'SEQUENCE' | 'PREFERENCE' | 'OPTIMIZATION' | 'ERROR';
  description: string;
  confidence: number; // 0-1
  usageCount: number;
  successRate: number;
  lastUsedAt?: Date;
  createdAt: Date;
}

export interface ExecutionFeedback {
  executionId: string;
  userRating?: number; // 1-5
  userComment?: string;
  success: boolean;
  durationMs: number;
  tokensUsed: number;
  stepsCount: number;
  errorCount: number;
  patterns: string[]; // pattern IDs
  createdAt: Date;
}

// Cache
export interface CacheEntry {
  key: string;
  value: any;
  embedding?: number[]; // for semantic search
  ttlSeconds: number;
  createdAt: Date;
  expiresAt: Date;
  hitCount: number;
  lastHitAt?: Date;
}

export interface CacheKey {
  type: string;
  query: string;
  parameters?: Record<string, any>;
}

// Events and Streaming
export type StreamEventType =
  | 'progress'
  | 'log'
  | 'partial_result'
  | 'error'
  | 'complete'
  | 'approval_required'
  | 'step_started'
  | 'step_completed';

export interface StreamEvent {
  type: StreamEventType;
  executionId: string;
  timestamp: Date;
  data: any;
}

export interface ProgressEvent {
  stepNumber: number;
  stepName: string;
  status: StepStatus;
  progress?: number; // 0-1
  message: string;
}

export interface LogEvent {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  source: string; // agent ID or component name
  message: string;
  metadata?: Record<string, any>;
}

// Parallel Execution
export interface ExecutionBatch {
  batchNumber: number;
  steps: ExecutionStep[];
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt?: Date;
  completedAt?: Date;
}

// Error Recovery
export interface RetryConfig {
  maxRetries: number;
  backoffMs: number[];
  retryableErrors: string[];
}

export interface AlternativeAgent {
  agentId: string;
  confidence: number;
  reason: string;
}

// Conflict Resolution
export interface ResourceLock {
  resourceId: string;
  lockedBy: string; // execution ID or agent ID
  lockedAt: Date;
  expiresAt: Date;
  metadata?: Record<string, any>;
}

export interface Conflict {
  id: string;
  executionId: string;
  type: 'RESOURCE' | 'DATA' | 'SEQUENCE';
  conflictingActions: ConflictingAction[];
  detectedAt: Date;
  resolved: boolean;
  resolution?: ConflictResolution;
}

export interface ConflictingAction {
  stepId: string;
  agentId: string;
  action: string;
  resource: string;
}

export interface ConflictResolution {
  strategy: 'MERGE' | 'SEQUENCE' | 'ABORT' | 'ASK_USER';
  appliedAt: Date;
  result: string;
}
