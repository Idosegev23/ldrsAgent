/**
 * Master Orchestrator
 * Main entry point for autonomous AI orchestration
 */

import type { Execution, ExecutionConfig } from '../types/orchestration.types.js';
import type { ExecutionContext } from '../types/execution.types.js';
import { Planner } from './planner.js';
import { ParallelExecutor } from './parallel-executor.js';
import { StateManager } from './state-manager.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class MasterOrchestrator {
  private planner: Planner;
  private executor: ParallelExecutor;
  private stateManager: StateManager;
  private activeExecutions: Map<string, ExecutionContext>;

  constructor() {
    this.planner = new Planner();
    this.executor = new ParallelExecutor();
    this.stateManager = new StateManager();
    this.activeExecutions = new Map();
  }

  /**
   * Start a new execution
   */
  async start(
    request: string,
    userId: string,
    options: Partial<ExecutionConfig> = {}
  ): Promise<Execution> {
    const executionId = uuidv4();
    
    logger.info('Starting new execution', {
      executionId,
      userId,
      request: request.substring(0, 100)
    });

    // Create execution record
    const execution: Execution = {
      id: executionId,
      userId,
      workspaceId: options.workspaceId,
      request,
      status: 'PLANNING',
      currentStep: 0,
      totalSteps: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save initial state
    await this.stateManager.saveExecution(execution);

    // Create execution context
    const context: ExecutionContext = {
      executionId,
      userId,
      workspaceId: options.workspaceId,
      sharedData: new Map(),
      locks: new Set(),
      startTime: new Date()
    };
    this.activeExecutions.set(executionId, context);

    try {
      // Phase 1: Planning
      logger.info('Creating execution plan', { executionId });
      const plan = await this.planner.createPlan(request, userId, context);
      
      execution.plan = plan;
      execution.totalSteps = plan.steps.length;
      execution.status = 'RUNNING';
      execution.updatedAt = new Date();
      
      await this.stateManager.saveExecution(execution);

      // Phase 2: Execution (run in background)
      this.executeInBackground(execution, context, options);

      return execution;
    } catch (error) {
      logger.error('Failed to start execution', {
        executionId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      execution.status = 'FAILED';
      execution.error = error instanceof Error ? error.message : String(error);
      execution.updatedAt = new Date();
      execution.completedAt = new Date();
      
      await this.stateManager.saveExecution(execution);
      this.activeExecutions.delete(executionId);
      
      throw error;
    }
  }

  /**
   * Execute plan in background
   */
  private async executeInBackground(
    execution: Execution,
    context: ExecutionContext,
    options: Partial<ExecutionConfig>
  ): Promise<void> {
    try {
      if (!execution.plan) {
        throw new Error('No execution plan found');
      }

      // Execute the plan
      const result = await this.executor.execute(
        execution.plan,
        context,
        options
      );

      // Update execution with result
      execution.status = result.success ? 'COMPLETED' : 'FAILED';
      execution.result = result;
      execution.updatedAt = new Date();
      execution.completedAt = new Date();
      
      await this.stateManager.saveExecution(execution);
      
      logger.info('Execution completed', {
        executionId: execution.id,
        success: result.success,
        durationMs: result.totalDurationMs
      });
    } catch (error) {
      logger.error('Execution failed', {
        executionId: execution.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      execution.status = 'FAILED';
      execution.error = error instanceof Error ? error.message : String(error);
      execution.updatedAt = new Date();
      execution.completedAt = new Date();
      
      await this.stateManager.saveExecution(execution);
    } finally {
      this.activeExecutions.delete(execution.id);
    }
  }

  /**
   * Get execution status
   */
  async getExecution(executionId: string): Promise<Execution | null> {
    return this.stateManager.getExecution(executionId);
  }

  /**
   * Pause execution
   */
  async pause(executionId: string): Promise<void> {
    const execution = await this.stateManager.getExecution(executionId);
    if (!execution) {
      throw new Error('Execution not found');
    }

    if (execution.status !== 'RUNNING') {
      throw new Error('Can only pause running executions');
    }

    // Create checkpoint before pausing
    await this.stateManager.createCheckpoint(execution);

    execution.status = 'PAUSED';
    execution.updatedAt = new Date();
    await this.stateManager.saveExecution(execution);

    logger.info('Execution paused', { executionId });
  }

  /**
   * Resume execution
   */
  async resume(executionId: string): Promise<void> {
    const execution = await this.stateManager.getExecution(executionId);
    if (!execution) {
      throw new Error('Execution not found');
    }

    if (execution.status !== 'PAUSED') {
      throw new Error('Can only resume paused executions');
    }

    // Restore from last checkpoint
    const checkpoint = await this.stateManager.getLatestCheckpoint(executionId);
    if (!checkpoint) {
      throw new Error('No checkpoint found to resume from');
    }

    // Create new context
    const context: ExecutionContext = {
      executionId,
      userId: execution.userId,
      workspaceId: execution.workspaceId,
      sharedData: new Map(Object.entries(checkpoint.context.data)),
      locks: new Set(),
      startTime: new Date()
    };
    this.activeExecutions.set(executionId, context);

    execution.status = 'RUNNING';
    execution.updatedAt = new Date();
    await this.stateManager.saveExecution(execution);

    logger.info('Execution resumed', { executionId });

    // Continue execution in background
    this.executeInBackground(execution, context, {});
  }

  /**
   * Cancel execution
   */
  async cancel(executionId: string): Promise<void> {
    const execution = await this.stateManager.getExecution(executionId);
    if (!execution) {
      throw new Error('Execution not found');
    }

    if (execution.status === 'COMPLETED' || execution.status === 'FAILED') {
      throw new Error('Cannot cancel completed or failed execution');
    }

    execution.status = 'CANCELLED';
    execution.updatedAt = new Date();
    execution.completedAt = new Date();
    await this.stateManager.saveExecution(execution);

    this.activeExecutions.delete(executionId);

    logger.info('Execution cancelled', { executionId });
  }

  /**
   * Get active executions count
   */
  getActiveCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * Get execution context
   */
  getContext(executionId: string): ExecutionContext | undefined {
    return this.activeExecutions.get(executionId);
  }

  /**
   * Cleanup finished executions
   */
  async cleanup(): Promise<void> {
    // Remove contexts for finished executions
    for (const [executionId, context] of this.activeExecutions.entries()) {
      const execution = await this.stateManager.getExecution(executionId);
      if (execution && 
          (execution.status === 'COMPLETED' || 
           execution.status === 'FAILED' || 
           execution.status === 'CANCELLED')) {
        this.activeExecutions.delete(executionId);
      }
    }
  }

  /**
   * Recover running executions after server restart
   */
  async recoverRunningExecutions(): Promise<void> {
    logger.info('Recovering running executions after restart');
    
    const runningExecutions = await this.stateManager.getRunningExecutions();
    
    for (const execution of runningExecutions) {
      try {
        logger.info('Recovering execution', { executionId: execution.id });
        
        // Mark as paused first
        execution.status = 'PAUSED';
        await this.stateManager.saveExecution(execution);
        
        // Try to resume
        await this.resume(execution.id);
      } catch (error) {
        logger.error('Failed to recover execution', {
          executionId: execution.id,
          error: error instanceof Error ? error.message : String(error)
        });
        
        execution.status = 'FAILED';
        execution.error = 'Failed to recover after server restart';
        execution.completedAt = new Date();
        await this.stateManager.saveExecution(execution);
      }
    }
  }
}

// Singleton instance
export const masterOrchestrator = new MasterOrchestrator();
