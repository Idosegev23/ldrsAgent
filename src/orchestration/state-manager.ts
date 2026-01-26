/**
 * State Manager
 * Manages execution state, checkpoints, and persistence
 */

import type {
  Execution,
  ExecutionCheckpoint,
  SharedContext,
  ContextValue
} from '../types/orchestration.types.js';
import { supabase } from '../db/client.js';
import { logger } from '../utils/logger.js';

export class StateManager {
  // In-memory cache for active executions
  private executionsCache: Map<string, Execution>;
  private contextsCache: Map<string, SharedContext>;

  constructor() {
    this.executionsCache = new Map();
    this.contextsCache = new Map();
  }

  /**
   * Save execution to database
   */
  async saveExecution(execution: Execution): Promise<void> {
    try {
      const { error } = await supabase
        .from('executions')
        .upsert({
          id: execution.id,
          user_id: execution.userId,
          workspace_id: execution.workspaceId,
          request: execution.request,
          plan: execution.plan ? JSON.stringify(execution.plan) : null,
          status: execution.status,
          current_step: execution.currentStep,
          total_steps: execution.totalSteps,
          result: execution.result ? JSON.stringify(execution.result) : null,
          error: execution.error,
          created_at: execution.createdAt.toISOString(),
          updated_at: execution.updatedAt.toISOString(),
          completed_at: execution.completedAt?.toISOString()
        });

      if (error) {
        throw error;
      }

      // Update cache
      this.executionsCache.set(execution.id, execution);
    } catch (error) {
      logger.error('Failed to save execution', {
        executionId: execution.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get execution from database
   */
  async getExecution(executionId: string): Promise<Execution | null> {
    // Check cache first
    if (this.executionsCache.has(executionId)) {
      return this.executionsCache.get(executionId)!;
    }

    try {
      const { data, error } = await supabase
        .from('executions')
        .select('*')
        .eq('id', executionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw error;
      }

      if (!data) {
        return null;
      }

      const execution: Execution = {
        id: data.id,
        userId: data.user_id,
        workspaceId: data.workspace_id,
        request: data.request,
        plan: data.plan ? JSON.parse(data.plan) : undefined,
        status: data.status,
        currentStep: data.current_step,
        totalSteps: data.total_steps,
        result: data.result ? JSON.parse(data.result) : undefined,
        error: data.error,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        completedAt: data.completed_at ? new Date(data.completed_at) : undefined
      };

      // Update cache
      this.executionsCache.set(executionId, execution);

      return execution;
    } catch (error) {
      logger.error('Failed to get execution', {
        executionId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get running executions
   */
  async getRunningExecutions(): Promise<Execution[]> {
    try {
      const { data, error } = await supabase
        .from('executions')
        .select('*')
        .eq('status', 'RUNNING')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data || []).map(row => ({
        id: row.id,
        userId: row.user_id,
        workspaceId: row.workspace_id,
        request: row.request,
        plan: row.plan ? JSON.parse(row.plan) : undefined,
        status: row.status,
        currentStep: row.current_step,
        totalSteps: row.total_steps,
        result: row.result ? JSON.parse(row.result) : undefined,
        error: row.error,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        completedAt: row.completed_at ? new Date(row.completed_at) : undefined
      }));
    } catch (error) {
      logger.error('Failed to get running executions', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Create checkpoint
   */
  async createCheckpoint(execution: Execution): Promise<ExecutionCheckpoint> {
    try {
      // Get current context
      const context = await this.getContext(execution.id);
      
      // Get last checkpoint number
      const { data: checkpoints } = await supabase
        .from('execution_checkpoints')
        .select('checkpoint_number')
        .eq('execution_id', execution.id)
        .order('checkpoint_number', { ascending: false })
        .limit(1);

      const nextCheckpointNumber = checkpoints && checkpoints.length > 0
        ? checkpoints[0].checkpoint_number + 1
        : 1;

      const checkpoint: ExecutionCheckpoint = {
        executionId: execution.id,
        checkpointNumber: nextCheckpointNumber,
        state: {
          currentStep: execution.currentStep,
          completedSteps: [], // TODO: track from execution plan
          failedSteps: [],
          stepResults: {},
          metadata: {}
        },
        context,
        createdAt: new Date()
      };

      const { error } = await supabase
        .from('execution_checkpoints')
        .insert({
          execution_id: checkpoint.executionId,
          checkpoint_number: checkpoint.checkpointNumber,
          state: JSON.stringify(checkpoint.state),
          context: JSON.stringify(checkpoint.context),
          created_at: checkpoint.createdAt.toISOString()
        });

      if (error) {
        throw error;
      }

      logger.info('Checkpoint created', {
        executionId: execution.id,
        checkpointNumber: nextCheckpointNumber
      });

      return checkpoint;
    } catch (error) {
      logger.error('Failed to create checkpoint', {
        executionId: execution.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get latest checkpoint
   */
  async getLatestCheckpoint(executionId: string): Promise<ExecutionCheckpoint | null> {
    try {
      const { data, error } = await supabase
        .from('execution_checkpoints')
        .select('*')
        .eq('execution_id', executionId)
        .order('checkpoint_number', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      if (!data) {
        return null;
      }

      return {
        executionId: data.execution_id,
        checkpointNumber: data.checkpoint_number,
        state: JSON.parse(data.state),
        context: JSON.parse(data.context),
        createdAt: new Date(data.created_at)
      };
    } catch (error) {
      logger.error('Failed to get latest checkpoint', {
        executionId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Get shared context
   */
  async getContext(executionId: string): Promise<SharedContext> {
    // Check cache
    if (this.contextsCache.has(executionId)) {
      return this.contextsCache.get(executionId)!;
    }

    try {
      const { data, error } = await supabase
        .from('shared_context')
        .select('*')
        .eq('execution_id', executionId);

      if (error) {
        throw error;
      }

      const contextData: Record<string, ContextValue> = {};
      
      for (const row of data || []) {
        contextData[row.key] = {
          value: JSON.parse(row.value),
          createdBy: row.created_by,
          createdAt: new Date(row.created_at),
          expiresAt: row.expires_at ? new Date(row.expires_at) : undefined
        };
      }

      const context: SharedContext = {
        executionId,
        data: contextData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Update cache
      this.contextsCache.set(executionId, context);

      return context;
    } catch (error) {
      logger.error('Failed to get context', {
        executionId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return empty context on error
      return {
        executionId,
        data: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
  }

  /**
   * Set context value
   */
  async setContextValue(
    executionId: string,
    key: string,
    value: any,
    createdBy: string,
    expiresAt?: Date
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('shared_context')
        .upsert({
          execution_id: executionId,
          key,
          value: JSON.stringify(value),
          created_by: createdBy,
          created_at: new Date().toISOString(),
          expires_at: expiresAt?.toISOString()
        });

      if (error) {
        throw error;
      }

      // Update cache
      const context = await this.getContext(executionId);
      context.data[key] = {
        value,
        createdBy,
        createdAt: new Date(),
        expiresAt
      };
      context.updatedAt = new Date();
      this.contextsCache.set(executionId, context);
    } catch (error) {
      logger.error('Failed to set context value', {
        executionId,
        key,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.executionsCache.clear();
    this.contextsCache.clear();
  }
}
