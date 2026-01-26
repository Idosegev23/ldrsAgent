/**
 * Parallel Coordinator
 * Manages parallel execution of independent steps
 */

import type {
  ExecutionStep,
  ExecutionBatch,
  DependencyGraph
} from '../../types/orchestration.types.js';
import type { StepExecutionResult } from '../../types/execution.types.js';
import { logger } from '../../utils/logger.js';

export class ParallelCoordinator {
  private maxConcurrent: number;

  constructor(maxConcurrent: number = 5) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Analyze dependencies and create execution batches
   */
  analyzeDependencies(
    steps: ExecutionStep[],
    graph: DependencyGraph
  ): ExecutionBatch[] {
    const batches: ExecutionBatch[] = [];
    const processed = new Set<string>();
    let batchNumber = 1;

    while (processed.size < steps.length) {
      // Find steps that can run (all dependencies completed)
      const availableSteps = steps.filter(step => {
        if (processed.has(step.id)) return false;

        // Check if all dependencies are processed
        const deps = this.getDependencies(step.id, graph);
        return deps.every(depId => processed.has(depId));
      });

      if (availableSteps.length === 0 && processed.size < steps.length) {
        // Deadlock detected
        throw new Error('Circular dependency detected in execution plan');
      }

      if (availableSteps.length > 0) {
        const batch: ExecutionBatch = {
          batchNumber,
          steps: availableSteps,
          status: 'PENDING'
        };

        batches.push(batch);
        availableSteps.forEach(step => processed.add(step.id));
        batchNumber++;
      }
    }

    logger.info('Dependency analysis complete', {
      totalSteps: steps.length,
      totalBatches: batches.length,
      maxBatchSize: Math.max(...batches.map(b => b.steps.length))
    });

    return batches;
  }

  /**
   * Execute batch of steps in parallel
   */
  async executeBatch(
    batch: ExecutionBatch,
    executor: (step: ExecutionStep) => Promise<StepExecutionResult>
  ): Promise<StepExecutionResult[]> {
    batch.status = 'RUNNING';
    batch.startedAt = new Date();

    logger.info('Executing batch', {
      batchNumber: batch.batchNumber,
      stepCount: batch.steps.length
    });

    const results: StepExecutionResult[] = [];

    // Execute in parallel with concurrency limit
    for (let i = 0; i < batch.steps.length; i += this.maxConcurrent) {
      const chunk = batch.steps.slice(i, i + this.maxConcurrent);
      
      const chunkResults = await Promise.all(
        chunk.map(step => this.executeWithErrorHandling(step, executor))
      );

      results.push(...chunkResults);
    }

    batch.status = results.every(r => r.success) ? 'COMPLETED' : 'FAILED';
    batch.completedAt = new Date();

    logger.info('Batch execution complete', {
      batchNumber: batch.batchNumber,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });

    return results;
  }

  /**
   * Execute step with error handling
   */
  private async executeWithErrorHandling(
    step: ExecutionStep,
    executor: (step: ExecutionStep) => Promise<StepExecutionResult>
  ): Promise<StepExecutionResult> {
    try {
      return await executor(step);
    } catch (error) {
      logger.error('Step execution error', {
        stepId: step.id,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        stepId: step.id,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        durationMs: 0
      };
    }
  }

  /**
   * Get dependencies for a step
   */
  private getDependencies(stepId: string, graph: DependencyGraph): string[] {
    return graph.edges
      .filter(edge => edge.to === stepId)
      .map(edge => edge.from);
  }

  /**
   * Get optimal batch configuration
   */
  getOptimalBatchSize(totalSteps: number): number {
    // Calculate based on system resources and step count
    if (totalSteps <= 5) return totalSteps;
    if (totalSteps <= 10) return 3;
    return Math.min(5, Math.ceil(totalSteps / 3));
  }

  /**
   * Estimate parallel execution time
   */
  estimateParallelDuration(
    batches: ExecutionBatch[],
    avgStepDuration: number
  ): number {
    let totalDuration = 0;

    for (const batch of batches) {
      // Max duration in batch (all run in parallel)
      const batchDuration = avgStepDuration;
      totalDuration += batchDuration;
    }

    return totalDuration;
  }

  /**
   * Get parallelization efficiency
   */
  getEfficiency(
    totalSteps: number,
    batchCount: number
  ): number {
    // Efficiency = (ideal parallel time) / (actual batch count)
    const idealBatches = Math.ceil(totalSteps / this.maxConcurrent);
    return idealBatches / batchCount;
  }
}
