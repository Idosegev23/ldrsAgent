/**
 * Execution Engine
 * Executes plans with dependency management
 */

import type {
  ExecutionPlan,
  ExecutionStep,
  ExecutionResult,
  StepStatus,
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

export class Executor {
  private runningSteps: Map<string, Promise<StepExecutionResult>>;
  private realExecutionAgent: RealExecutionAgent;
  private canvaAgent: CanvaAgent;

  constructor() {
    this.runningSteps = new Map();
    this.realExecutionAgent = new RealExecutionAgent();
    this.canvaAgent = new CanvaAgent();
  }

  /**
   * Execute a plan
   */
  async execute(
    plan: ExecutionPlan,
    context: ExecutionContext,
    config: Partial<ExecutionConfig>
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const stepResults: StepExecutionResult[] = [];

    logger.info('Starting plan execution', {
      executionId: context.executionId,
      totalSteps: plan.steps.length
    });

    try {
      // Execute steps in order, respecting dependencies
      for (const step of plan.steps) {
        // Wait for dependencies
        await this.waitForDependencies(step, plan.steps, stepResults);

        // Execute step
        const result = await this.executeStep(step, context, config);
        stepResults.push(result);

        // Update step status
        step.status = result.success ? 'COMPLETED' : 'FAILED';
        step.startedAt = new Date(Date.now() - result.durationMs);
        step.completedAt = new Date();
        step.durationMs = result.durationMs;
        step.tokensUsed = result.tokensUsed;

        if (!result.success) {
          step.error = result.error?.message;
          logger.error('Step failed', {
            executionId: context.executionId,
            stepId: step.id,
            error: result.error?.message
          });
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
        summary: this.buildSummary(plan.steps, stepResults),
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

      logger.info('Plan execution completed', {
        executionId: context.executionId,
        success: allSuccessful,
        durationMs: totalDurationMs,
        tokensUsed: totalTokensUsed
      });

      return result;
    } catch (error) {
      logger.error('Plan execution failed', {
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
   * Execute a single step
   */
  private async executeStep(
    step: ExecutionStep,
    context: ExecutionContext,
    config: Partial<ExecutionConfig>
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();

    logger.info('Executing step', {
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
          request: step.input?.request || step.description,
          executionId: context.executionId,
          context
        });
        
        output = {
          success: !result.error,
          data: result,
          summary: `נמצאו ${result.filesFound} קבצים, ${result.filesAnalyzed.length} נותחו`,
          confidence: result.analysis.ppcInsights.length > 0 ? 'high' : 'medium'
        };
      } else if (step.agentId === 'canva_agent' || step.agentName.includes('Canva')) {
        // Use CanvaAgent for Canva operations
        const result = await this.canvaAgent.execute({
          userId: context.userId,
          request: step.input?.request || step.description,
          executionId: context.executionId,
          context
        });
        
        output = {
          success: result.success,
          data: result.data,
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
        success: true,
        output,
        durationMs,
        tokensUsed: 500
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;

      return {
        stepId: step.id,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        durationMs
      };
    }
  }

  /**
   * Wait for step dependencies to complete
   */
  private async waitForDependencies(
    step: ExecutionStep,
    allSteps: ExecutionStep[],
    completedResults: StepExecutionResult[]
  ): Promise<void> {
    // Find dependency steps
    const depSteps = allSteps.filter(s => step.dependencies.includes(s.id));

    // Wait for all dependencies
    for (const depStep of depSteps) {
      const depResult = completedResults.find(r => r.stepId === depStep.id);
      
      if (!depResult) {
        throw new Error(`Dependency step ${depStep.id} not found in results`);
      }

      if (!depResult.success) {
        throw new Error(`Dependency step ${depStep.stepNumber} failed`);
      }
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
    await new Promise(resolve => setTimeout(resolve, 1000));

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
  private buildSummary(steps: ExecutionStep[], results: StepExecutionResult[]): string {
    const completed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const total = steps.length;

    return `Execution completed: ${completed}/${total} steps successful, ${failed} failed`;
  }

  /**
   * Cancel step execution
   */
  async cancelStep(stepId: string): Promise<void> {
    // TODO: Implement step cancellation
    this.runningSteps.delete(stepId);
  }

  /**
   * Get running steps count
   */
  getRunningStepsCount(): number {
    return this.runningSteps.size;
  }
}
