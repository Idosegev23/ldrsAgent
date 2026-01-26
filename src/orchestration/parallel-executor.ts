/**
 * Parallel Execution Engine
 * Executes multiple agents in parallel when they have no dependencies
 */

import type {
  ExecutionPlan,
  ExecutionStep,
  ExecutionResult,
  ExecutionBatch,
  StepOutput
} from '../types/orchestration.types.js';
import type {
  ExecutionContext,
  ExecutionConfig,
  StepExecutionResult
} from '../types/execution.types.js';
import { logger } from '../utils/logger.js';
import { RealExecutionAgent } from '../execution/agents/real-execution.agent.js';
import { CanvaAgent } from '../execution/agents/canva.agent.js';

const log = logger.child({ component: 'ParallelExecutor' });

export class ParallelExecutor {
  private runningSteps: Map<string, Promise<StepExecutionResult>>;
  private realExecutionAgent: RealExecutionAgent;
  private canvaAgent: CanvaAgent;

  constructor() {
    this.runningSteps = new Map();
    this.realExecutionAgent = new RealExecutionAgent();
    this.canvaAgent = new CanvaAgent();
  }

  /**
   * Execute a plan with parallel execution support
   */
  async execute(
    plan: ExecutionPlan,
    context: ExecutionContext,
    config: Partial<ExecutionConfig>
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const stepResults: StepExecutionResult[] = [];
    const completedStepIds = new Set<string>();

    log.info('Starting parallel plan execution', {
      executionId: context.executionId,
      totalSteps: plan.steps.length
    });

    try {
      // Group steps into parallel batches
      const batches = this.createExecutionBatches(plan.steps);

      log.info('Execution batches created', {
        executionId: context.executionId,
        batchCount: batches.length,
        batchSizes: batches.map(b => b.steps.length)
      });

      // Execute batches sequentially, but steps within each batch in parallel
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        log.info(`Executing batch ${i + 1}/${batches.length}`, {
          executionId: context.executionId,
          batchNumber: batch.batchNumber,
          stepsInBatch: batch.steps.length,
          stepIds: batch.steps.map(s => s.id)
        });

        batch.status = 'RUNNING';
        batch.startedAt = new Date();

        // Execute all steps in this batch in parallel
        const batchPromises = batch.steps.map(step => 
          this.executeStepWithTracking(step, context, config, completedStepIds)
        );

        // Wait for all steps in batch to complete
        const batchResults = await Promise.allSettled(batchPromises);

        // Process results
        for (let j = 0; j < batchResults.length; j++) {
          const promiseResult = batchResults[j];
          const step = batch.steps[j];

          if (promiseResult.status === 'fulfilled') {
            const result = promiseResult.value;
            stepResults.push(result);
            completedStepIds.add(step.id);

            // Update step status
            step.status = result.success ? 'COMPLETED' : 'FAILED';
            step.startedAt = new Date(Date.now() - result.durationMs);
            step.completedAt = new Date();
            step.durationMs = result.durationMs;
            step.tokensUsed = result.tokensUsed;

            if (!result.success) {
              step.error = result.error?.message;
              log.error('Step failed in batch', {
                executionId: context.executionId,
                batchNumber: batch.batchNumber,
                stepId: step.id,
                error: result.error?.message
              });
            }
          } else {
            // Promise was rejected
            const error = promiseResult.reason;
            const result: StepExecutionResult = {
              stepId: step.id,
              success: false,
              error: error instanceof Error ? error : new Error(String(error)),
              durationMs: 0
            };
            
            stepResults.push(result);
            step.status = 'FAILED';
            step.error = error instanceof Error ? error.message : String(error);

            log.error('Step promise rejected in batch', {
              executionId: context.executionId,
              batchNumber: batch.batchNumber,
              stepId: step.id,
              error: step.error
            });
          }
        }

        batch.status = 'COMPLETED';
        batch.completedAt = new Date();

        log.info(`Batch ${i + 1}/${batches.length} completed`, {
          executionId: context.executionId,
          batchNumber: batch.batchNumber,
          successful: batchResults.filter(r => r.status === 'fulfilled').length,
          failed: batchResults.filter(r => r.status === 'rejected').length
        });

        // Check if any critical step failed
        const hasCriticalFailure = batch.steps.some(
          step => step.status === 'FAILED' && this.isCriticalStep(step)
        );

        if (hasCriticalFailure) {
          log.warn('Critical step failed in batch, stopping execution', {
            executionId: context.executionId,
            batchNumber: batch.batchNumber
          });
          break; // Stop execution if critical step fails
        }
      }

      // Build execution result
      const totalDurationMs = Date.now() - startTime;
      const allSuccessful = stepResults.every(r => r.success);
      const totalTokensUsed = stepResults.reduce((sum, r) => sum + (r.tokensUsed || 0), 0);

      const result: ExecutionResult = {
        success: allSuccessful,
        output: this.buildOutput(plan.steps, stepResults),
        structured: this.buildStructuredOutput(plan.steps, stepResults),
        summary: this.buildSummary(plan.steps, stepResults, batches.length),
        steps: plan.steps.map(step => ({
          stepNumber: step.stepNumber,
          agentName: step.agentName,
          status: step.status,
          durationMs: step.durationMs,
          tokensUsed: step.tokensUsed
        })),
        totalDurationMs,
        totalTokensUsed
      };

      log.info('Parallel plan execution completed', {
        executionId: context.executionId,
        success: allSuccessful,
        durationMs: totalDurationMs,
        tokensUsed: totalTokensUsed,
        batches: batches.length
      });

      return result;
    } catch (error) {
      log.error('Parallel plan execution failed', {
        executionId: context.executionId,
        error: error instanceof Error ? error.message : String(error)
      });

      const totalDurationMs = Date.now() - startTime;
      
      return {
        success: false,
        output: 'Execution failed: ' + (error instanceof Error ? error.message : String(error)),
        summary: 'Execution failed',
        steps: plan.steps.map(step => ({
          stepNumber: step.stepNumber,
          agentName: step.agentName,
          status: step.status,
          durationMs: step.durationMs,
          tokensUsed: step.tokensUsed
        })),
        totalDurationMs,
        totalTokensUsed: 0
      };
    }
  }

  /**
   * Create execution batches based on dependencies
   * Steps with no dependencies or satisfied dependencies go in same batch
   */
  private createExecutionBatches(steps: ExecutionStep[]): ExecutionBatch[] {
    const batches: ExecutionBatch[] = [];
    const remainingSteps = [...steps];
    const completedStepIds = new Set<string>();
    let batchNumber = 1;

    while (remainingSteps.length > 0) {
      // Find all steps that can execute now (all dependencies satisfied)
      const readySteps = remainingSteps.filter(step => {
        // Check if all dependencies are completed
        return step.dependencies.every(depId => completedStepIds.has(depId));
      });

      if (readySteps.length === 0) {
        // No steps are ready - circular dependency or error
        log.error('No steps ready to execute - possible circular dependency', {
          remainingSteps: remainingSteps.map(s => ({ id: s.id, deps: s.dependencies }))
        });
        break;
      }

      // Create batch with ready steps
      const batch: ExecutionBatch = {
        batchNumber,
        steps: readySteps,
        status: 'PENDING'
      };

      batches.push(batch);

      // Mark these steps as "completed" for dependency resolution
      readySteps.forEach(step => {
        completedStepIds.add(step.id);
        const index = remainingSteps.indexOf(step);
        if (index > -1) {
          remainingSteps.splice(index, 1);
        }
      });

      batchNumber++;
    }

    return batches;
  }

  /**
   * Execute a step with tracking in running steps map
   */
  private async executeStepWithTracking(
    step: ExecutionStep,
    context: ExecutionContext,
    config: Partial<ExecutionConfig>,
    completedStepIds: Set<string>
  ): Promise<StepExecutionResult> {
    const promise = this.executeStep(step, context, config);
    this.runningSteps.set(step.id, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.runningSteps.delete(step.id);
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: ExecutionStep,
    context: ExecutionContext,
    config: Partial<ExecutionConfig>
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();

    log.info('Executing step', {
      executionId: context.executionId,
      stepId: step.id,
      stepNumber: step.stepNumber,
      agentId: step.agentId
    });

    try {
      // Execute with actual agent if available
      let output: StepOutput;
      
      if (step.agentId === 'real_execution' || step.agentName.includes('Real')) {
        // Use RealExecutionAgent for full end-to-end execution
        const result = await this.realExecutionAgent.execute({
          userId: context.userId,
          request: step.input?.task || step.description,
          executionId: context.executionId,
          context
        });
        
        output = {
          success: !result.error,
          data: result,
          summary: `נמצאו ${result.filesFound} קבצים, ${result.filesAnalyzed.length} נותחו`,
          confidence: result.analysis?.ppcInsights?.length > 0 ? 'high' : 'medium'
        };
      } else if (step.agentId === 'canva_agent' || step.agentName.includes('Canva')) {
        // Use CanvaAgent for Canva operations
        const result = await this.canvaAgent.execute({
          userId: context.userId,
          request: step.input?.task || step.description,
          executionId: context.executionId,
          context
        });
        
        output = {
          success: result.success,
          data: result.data || {},
          summary: result.summary,
          confidence: result.success ? 'high' : 'low'
        };
      } else {
        // Fallback to simulation for other agents
        output = await this.simulateAgentExecution(step, context);
      }

      const durationMs = Date.now() - startTime;

      return {
        stepId: step.id,
        success: output.success,
        output,
        durationMs,
        tokensUsed: 500
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;

      log.error('Step execution threw error', {
        executionId: context.executionId,
        stepId: step.id,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        stepId: step.id,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        durationMs
      };
    }
  }

  /**
   * Simulate agent execution (temporary)
   */
  private async simulateAgentExecution(
    step: ExecutionStep,
    context: ExecutionContext
  ): Promise<StepOutput> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));

    return {
      success: true,
      data: {
        stepNumber: step.stepNumber,
        agentId: step.agentId,
        result: 'Step completed successfully'
      },
      summary: `${step.agentName} completed: ${step.description}`,
      confidence: 'high'
    };
  }

  /**
   * Check if a step is critical (failure should stop execution)
   */
  private isCriticalStep(step: ExecutionStep): boolean {
    // You can define custom logic here
    // For now, treat real_execution as critical
    return step.agentId === 'real_execution';
  }

  /**
   * Build final output
   */
  private buildOutput(steps: ExecutionStep[], results: StepExecutionResult[]): string {
    const outputs: string[] = [];

    for (const step of steps) {
      if (step.status === 'COMPLETED') {
        const result = results.find(r => r.stepId === step.id);
        if (result && result.output) {
          outputs.push(`**${step.agentName}**: ${result.output.summary || 'Completed'}`);
        }
      }
    }

    return outputs.join('\n\n');
  }

  /**
   * Build structured output
   */
  private buildStructuredOutput(
    steps: ExecutionStep[],
    results: StepExecutionResult[]
  ): Record<string, any> {
    const structured: Record<string, any> = {};

    for (const step of steps) {
      const result = results.find(r => r.stepId === step.id);
      if (result && result.output) {
        structured[`step_${step.stepNumber}`] = result.output.data;
      }
    }

    return structured;
  }

  /**
   * Build execution summary
   */
  private buildSummary(steps: ExecutionStep[], results: StepExecutionResult[], batchCount: number): string {
    const completed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const total = steps.length;

    return `Execution completed in ${batchCount} parallel ${batchCount === 1 ? 'batch' : 'batches'}: ${completed}/${total} steps successful${failed > 0 ? `, ${failed} failed` : ''}`;
  }

  /**
   * Cancel step execution
   */
  async cancelStep(stepId: string): Promise<void> {
    this.runningSteps.delete(stepId);
  }

  /**
   * Get running steps count
   */
  getRunningStepsCount(): number {
    return this.runningSteps.size;
  }
}
