/**
 * Step Executor
 * Executes individual steps with all safety measures
 */

import type { ExecutionStep, StepOutput } from '../../types/orchestration.types.js';
import type { ExecutionContext, StepExecutionResult } from '../../types/execution.types.js';
import { errorRecovery } from './error-recovery.js';
import { rateLimiter } from '../safety/rate-limiter.js';
import { smartCache } from '../caching/smart-cache.js';
import { conflictResolver } from '../safety/conflict-resolver.js';
import { streamManager } from '../streaming/stream-manager.js';
import { metricsCollector } from '../monitoring/metrics.js';
import { logAggregator } from '../monitoring/log-aggregator.js';
import { logger } from '../../utils/logger.js';

export class StepExecutor {
  /**
   * Execute step with all safety measures
   */
  async executeWithSafety(
    step: ExecutionStep,
    context: ExecutionContext
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();

    logger.info('Executing step', {
      executionId: context.executionId,
      stepId: step.id,
      stepNumber: step.stepNumber,
      agentId: step.agentId
    });

    // Log to aggregator
    logAggregator.collect(
      `step-${step.stepNumber}`,
      'INFO',
      `Starting ${step.agentName}`,
      { stepId: step.id },
      context.executionId
    );

    // Emit progress
    streamManager.emitStepStarted(
      context.executionId,
      step.stepNumber,
      step.agentName
    );

    try {
      // 1. Check cache
      const cacheKey = {
        type: 'step',
        query: step.description,
        parameters: step.input
      };

      const cached = await smartCache.get(cacheKey);
      if (cached) {
        logger.info('Cache hit', { stepId: step.id });
        
        const durationMs = Date.now() - startTime;
        
        metricsCollector.recordDuration(`step.${step.agentId}`, durationMs);
        metricsCollector.recordSuccess(`step.${step.agentId}`);

        return {
          stepId: step.id,
          success: true,
          output: cached,
          durationMs,
          cacheHit: true
        };
      }

      // 2. Check rate limit
      const rateLimitOk = rateLimiter.checkLimit('agent', step.agentId);
      if (!rateLimitOk) {
        logger.warn('Rate limit exceeded', { stepId: step.id });
        throw new Error('Rate limit exceeded');
      }

      // 3. Acquire resource lock
      const lockAcquired = await conflictResolver.acquireLock(
        `step-${step.id}`,
        step.agentId,
        60000
      );

      if (!lockAcquired) {
        throw new Error('Could not acquire resource lock');
      }

      try {
        // 4. Execute with retry
        const result = await errorRecovery.retryStep(
          step,
          async (s) => await this.executeActualStep(s, context)
        );

        // 5. Cache result if successful
        if (result.success && result.output) {
          await smartCache.set(cacheKey, result.output, { ttl: 3600 });
        }

        // 6. Record metrics
        metricsCollector.recordDuration(`step.${step.agentId}`, result.durationMs);
        if (result.success) {
          metricsCollector.recordSuccess(`step.${step.agentId}`);
        } else {
          metricsCollector.recordFailure(`step.${step.agentId}`, result.error!);
        }

        // 7. Emit completion
        streamManager.emitStepCompleted(
          context.executionId,
          step.stepNumber,
          step.agentName,
          result.durationMs
        );

        return result;
      } finally {
        // Release lock
        await conflictResolver.releaseLock(`step-${step.id}`, step.agentId);
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));

      logger.error('Step execution failed', {
        stepId: step.id,
        error: err.message
      });

      logAggregator.collect(
        `step-${step.stepNumber}`,
        'ERROR',
        `Failed: ${err.message}`,
        { stepId: step.id },
        context.executionId
      );

      metricsCollector.recordFailure(`step.${step.agentId}`, err);

      return {
        stepId: step.id,
        success: false,
        error: err,
        durationMs
      };
    }
  }

  /**
   * Execute actual step (integrate with existing agents)
   */
  private async executeActualStep(
    step: ExecutionStep,
    context: ExecutionContext
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();

    // TODO: Integrate with actual agent execution
    // This would call the real agent based on step.agentId

    // For now, simulate
    await this.sleep(Math.random() * 2000 + 1000);

    const output: StepOutput = {
      success: true,
      data: {
        stepNumber: step.stepNumber,
        agentId: step.agentId,
        result: `Step ${step.stepNumber} completed`
      },
      summary: `${step.agentName}: ${step.description}`,
      confidence: 'high'
    };

    const durationMs = Date.now() - startTime;

    return {
      stepId: step.id,
      success: true,
      output,
      durationMs,
      tokensUsed: Math.floor(Math.random() * 1000) + 500
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const stepExecutor = new StepExecutor();
