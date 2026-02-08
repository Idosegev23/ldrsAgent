/**
 * Execution Engine Types
 * Lower-level execution types for the orchestration engine
 */

export interface ExecutionContext {
  executionId: string;
  userId: string;
  workspaceId?: string;
  sharedData: Map<string, any>;
  locks: Set<string>;
  startTime: Date;
}

export interface StepExecutionResult {
  stepId: string;
  success: boolean;
  output?: any;
  error?: Error;
  durationMs: number;
  tokensUsed?: number;
  cacheHit?: boolean;
  retryCount?: number;
}

export interface ParallelExecutionResult {
  batchNumber: number;
  results: StepExecutionResult[];
  totalDurationMs: number;
  allSuccessful: boolean;
}

export interface ExecutionMetrics {
  executionId: string;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  totalDurationMs: number;
  totalTokensUsed: number;
  cacheHitRate: number;
  averageStepDurationMs: number;
}

export interface StepDependencies {
  stepId: string;
  dependsOn: string[];
  requiredData: string[];
  optionalData?: string[];
}

export interface ExecutionPriority {
  level: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  reason?: string;
  deadline?: Date;
}

export interface ExecutionConfig {
  maxConcurrentSteps: number;
  enableCaching: boolean;
  enableLearning: boolean;
  requireApprovals: boolean;
  timeoutMs?: number;
  retryConfig: {
    maxRetries: number;
    backoffMs: number[];
  };
}
