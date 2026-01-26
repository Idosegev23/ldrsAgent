/**
 * Error Recovery
 * Handles errors, retries, and recovery strategies
 */

import type { ExecutionStep, AlternativeAgent } from '../../types/orchestration.types.js';
import type { RetryConfig, StepExecutionResult } from '../../types/execution.types.js';
import { logger } from '../../utils/logger.js';
import { agentRegistry } from '../agent-registry.js';

export class ErrorRecovery {
  private defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    backoffMs: [1000, 2000, 4000],
    retryableErrors: [
      'RATE_LIMIT',
      'TIMEOUT',
      'NETWORK_ERROR',
      'TEMPORARY_FAILURE'
    ]
  };

  /**
   * Retry step execution
   */
  async retryStep(
    step: ExecutionStep,
    executor: (step: ExecutionStep) => Promise<StepExecutionResult>,
    config?: Partial<RetryConfig>
  ): Promise<StepExecutionResult> {
    const retryConfig = { ...this.defaultRetryConfig, ...config };
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      if (attempt > 0) {
        const backoff = retryConfig.backoffMs[attempt - 1] || 
                       retryConfig.backoffMs[retryConfig.backoffMs.length - 1];
        
        logger.info('Retrying step', {
          stepId: step.id,
          attempt,
          backoffMs: backoff
        });

        await this.sleep(backoff);
      }

      try {
        const result = await executor(step);

        if (result.success) {
          if (attempt > 0) {
            logger.info('Step succeeded after retry', {
              stepId: step.id,
              attempts: attempt + 1
            });
          }
          return result;
        }

        lastError = result.error;

        // Check if error is retryable
        if (!this.isRetryable(lastError, retryConfig)) {
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (!this.isRetryable(lastError, retryConfig)) {
          break;
        }
      }
    }

    logger.error('Step failed after all retries', {
      stepId: step.id,
      attempts: retryConfig.maxRetries + 1,
      error: lastError?.message
    });

    return {
      stepId: step.id,
      success: false,
      error: lastError,
      durationMs: 0,
      retryCount: retryConfig.maxRetries
    };
  }

  /**
   * Find alternative agent
   */
  async findAlternative(
    failedAgentId: string,
    task: string
  ): Promise<AlternativeAgent | null> {
    logger.info('Finding alternative agent', {
      failedAgent: failedAgentId,
      task: task.substring(0, 50)
    });

    // Get agents that can handle the same capability
    const failedAgent = agentRegistry.getAgent(failedAgentId);
    
    if (!failedAgent) {
      return null;
    }

    // Find agents with similar capabilities
    const alternatives = agentRegistry
      .getAllAgents()
      .filter(agent => {
        if (agent.agentId === failedAgentId) return false;

        // Check capability overlap
        return agent.capabilities.some(agentCap =>
          failedAgent.capabilities.some(failedCap =>
            agentCap.name === failedCap.name
          )
        );
      })
      .map(agent => {
        const performance = agentRegistry.getPerformance(agent.agentId);
        const confidence = performance ? performance.successRate : 0.5;

        return {
          agentId: agent.agentId,
          confidence,
          reason: `Alternative agent with similar capabilities (${confidence * 100}% success rate)`
        };
      })
      .sort((a, b) => b.confidence - a.confidence);

    if (alternatives.length > 0) {
      logger.info('Alternative agent found', {
        failedAgent: failedAgentId,
        alternative: alternatives[0].agentId,
        confidence: alternatives[0].confidence
      });

      return alternatives[0];
    }

    return null;
  }

  /**
   * Handle partial failure
   */
  handlePartialFailure(
    completedSteps: ExecutionStep[],
    failedStep: ExecutionStep,
    remainingSteps: ExecutionStep[]
  ): 'CONTINUE' | 'ROLLBACK' | 'ASK_USER' {
    // Determine strategy based on context
    
    // If failed step is critical, rollback
    if (this.isCriticalStep(failedStep)) {
      logger.warn('Critical step failed, recommending rollback', {
        stepId: failedStep.id
      });
      return 'ROLLBACK';
    }

    // If many steps completed, ask user
    if (completedSteps.length > remainingSteps.length) {
      logger.warn('Many steps completed, recommending user decision', {
        completed: completedSteps.length,
        remaining: remainingSteps.length
      });
      return 'ASK_USER';
    }

    // Otherwise, try to continue
    logger.info('Recommending to continue execution', {
      failedStep: failedStep.id
    });
    return 'CONTINUE';
  }

  /**
   * Rollback execution
   */
  async rollback(
    executionId: string,
    completedSteps: ExecutionStep[]
  ): Promise<void> {
    logger.warn('Rolling back execution', {
      executionId,
      stepsToRollback: completedSteps.length
    });

    // Rollback in reverse order
    for (let i = completedSteps.length - 1; i >= 0; i--) {
      const step = completedSteps[i];

      try {
        await this.rollbackStep(step);
        logger.info('Step rolled back', { stepId: step.id });
      } catch (error) {
        logger.error('Rollback failed for step', {
          stepId: step.id,
          error: error instanceof Error ? error.message : String(error)
        });
        // Continue rollback even if one fails
      }
    }

    logger.info('Rollback complete', { executionId });
  }

  /**
   * Rollback individual step
   */
  private async rollbackStep(step: ExecutionStep): Promise<void> {
    // TODO: Implement step-specific rollback logic
    // For now, just log
    logger.info('Rolling back step', {
      stepId: step.id,
      agentId: step.agentId
    });
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: Error | undefined, config: RetryConfig): boolean {
    if (!error) return false;

    const errorMessage = error.message.toUpperCase();
    
    return config.retryableErrors.some(retryableError =>
      errorMessage.includes(retryableError)
    );
  }

  /**
   * Check if step is critical
   */
  private isCriticalStep(step: ExecutionStep): boolean {
    // TODO: Implement proper criticality check
    // For now, assume steps with no dependencies on them are non-critical
    return step.dependencies.length > 0;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error category
   */
  getErrorCategory(error: Error): string {
    const message = error.message.toUpperCase();

    if (message.includes('RATE') || message.includes('LIMIT')) {
      return 'RATE_LIMIT';
    }
    if (message.includes('TIMEOUT')) {
      return 'TIMEOUT';
    }
    if (message.includes('NETWORK') || message.includes('CONNECTION')) {
      return 'NETWORK_ERROR';
    }
    if (message.includes('AUTH') || message.includes('PERMISSION')) {
      return 'AUTH_ERROR';
    }
    if (message.includes('NOT FOUND') || message.includes('404')) {
      return 'NOT_FOUND';
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Get recovery recommendation
   */
  getRecoveryRecommendation(
    error: Error,
    attemptCount: number
  ): {
    action: 'RETRY' | 'ALTERNATIVE' | 'SKIP' | 'FAIL';
    reason: string;
  } {
    const category = this.getErrorCategory(error);

    switch (category) {
      case 'RATE_LIMIT':
        return {
          action: attemptCount < 3 ? 'RETRY' : 'SKIP',
          reason: 'Rate limit - retry with backoff'
        };

      case 'TIMEOUT':
        return {
          action: attemptCount < 2 ? 'RETRY' : 'ALTERNATIVE',
          reason: 'Timeout - try alternative agent'
        };

      case 'NETWORK_ERROR':
        return {
          action: attemptCount < 3 ? 'RETRY' : 'FAIL',
          reason: 'Network error - retry'
        };

      case 'AUTH_ERROR':
        return {
          action: 'FAIL',
          reason: 'Authentication error - requires manual intervention'
        };

      case 'NOT_FOUND':
        return {
          action: 'SKIP',
          reason: 'Resource not found - skip step'
        };

      default:
        return {
          action: attemptCount < 2 ? 'RETRY' : 'FAIL',
          reason: 'Unknown error - limited retry'
        };
    }
  }
}

// Singleton instance
export const errorRecovery = new ErrorRecovery();
