/**
 * Shared Context Store
 * Manages shared memory and data between agents during execution
 */

import type { SharedContext, ContextValue } from '../types/orchestration.types.js';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

export class SharedContextStore extends EventEmitter {
  private contexts: Map<string, Map<string, ContextValue>>;
  private locks: Map<string, Set<string>>;

  constructor() {
    super();
    this.contexts = new Map();
    this.locks = new Map();
  }

  /**
   * Initialize context for execution
   */
  initializeContext(executionId: string): void {
    if (!this.contexts.has(executionId)) {
      this.contexts.set(executionId, new Map());
      this.locks.set(executionId, new Set());
      
      logger.info('Context initialized', { executionId });
    }
  }

  /**
   * Set context value
   */
  set(
    executionId: string,
    key: string,
    value: any,
    createdBy: string,
    options?: {
      expiresAt?: Date;
      overwrite?: boolean;
    }
  ): void {
    this.initializeContext(executionId);
    
    const contextData = this.contexts.get(executionId)!;
    
    // Check if value exists and overwrite is false
    if (!options?.overwrite && contextData.has(key)) {
      throw new Error(`Context key "${key}" already exists. Use overwrite option to replace.`);
    }

    const contextValue: ContextValue = {
      value,
      createdBy,
      createdAt: new Date(),
      expiresAt: options?.expiresAt
    };

    contextData.set(key, contextValue);

    // Emit event
    this.emit('context:set', {
      executionId,
      key,
      value,
      createdBy
    });

    logger.debug('Context value set', {
      executionId,
      key,
      createdBy
    });
  }

  /**
   * Get context value
   */
  get(executionId: string, key: string): any | undefined {
    const contextData = this.contexts.get(executionId);
    
    if (!contextData) {
      return undefined;
    }

    const contextValue = contextData.get(key);
    
    if (!contextValue) {
      return undefined;
    }

    // Check expiration
    if (contextValue.expiresAt && contextValue.expiresAt < new Date()) {
      contextData.delete(key);
      logger.debug('Context value expired', { executionId, key });
      return undefined;
    }

    return contextValue.value;
  }

  /**
   * Get context value with metadata
   */
  getWithMetadata(executionId: string, key: string): ContextValue | undefined {
    const contextData = this.contexts.get(executionId);
    
    if (!contextData) {
      return undefined;
    }

    const contextValue = contextData.get(key);
    
    if (!contextValue) {
      return undefined;
    }

    // Check expiration
    if (contextValue.expiresAt && contextValue.expiresAt < new Date()) {
      contextData.delete(key);
      return undefined;
    }

    return contextValue;
  }

  /**
   * Check if key exists
   */
  has(executionId: string, key: string): boolean {
    const contextData = this.contexts.get(executionId);
    
    if (!contextData) {
      return false;
    }

    const contextValue = contextData.get(key);
    
    if (!contextValue) {
      return false;
    }

    // Check expiration
    if (contextValue.expiresAt && contextValue.expiresAt < new Date()) {
      contextData.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete context value
   */
  delete(executionId: string, key: string): boolean {
    const contextData = this.contexts.get(executionId);
    
    if (!contextData) {
      return false;
    }

    const deleted = contextData.delete(key);

    if (deleted) {
      this.emit('context:delete', { executionId, key });
      logger.debug('Context value deleted', { executionId, key });
    }

    return deleted;
  }

  /**
   * Get all keys
   */
  keys(executionId: string): string[] {
    const contextData = this.contexts.get(executionId);
    
    if (!contextData) {
      return [];
    }

    return Array.from(contextData.keys());
  }

  /**
   * Get all context data
   */
  getAll(executionId: string): Record<string, any> {
    const contextData = this.contexts.get(executionId);
    
    if (!contextData) {
      return {};
    }

    const result: Record<string, any> = {};
    const now = new Date();

    for (const [key, contextValue] of contextData.entries()) {
      // Skip expired values
      if (contextValue.expiresAt && contextValue.expiresAt < now) {
        contextData.delete(key);
        continue;
      }

      result[key] = contextValue.value;
    }

    return result;
  }

  /**
   * Get context as SharedContext object
   */
  getSharedContext(executionId: string): SharedContext {
    const contextData = this.contexts.get(executionId);
    const data: Record<string, ContextValue> = {};

    if (contextData) {
      const now = new Date();
      for (const [key, value] of contextData.entries()) {
        // Skip expired values
        if (value.expiresAt && value.expiresAt < now) {
          contextData.delete(key);
          continue;
        }
        data[key] = value;
      }
    }

    return {
      executionId,
      data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Merge context data
   */
  merge(
    executionId: string,
    data: Record<string, any>,
    createdBy: string
  ): void {
    for (const [key, value] of Object.entries(data)) {
      this.set(executionId, key, value, createdBy, { overwrite: true });
    }
  }

  /**
   * Clear context
   */
  clear(executionId: string): void {
    const contextData = this.contexts.get(executionId);
    
    if (contextData) {
      contextData.clear();
      this.emit('context:clear', { executionId });
      logger.info('Context cleared', { executionId });
    }

    // Clear locks
    const locks = this.locks.get(executionId);
    if (locks) {
      locks.clear();
    }
  }

  /**
   * Acquire lock on a key
   */
  acquireLock(executionId: string, key: string, ownerId: string): boolean {
    this.initializeContext(executionId);
    
    const locks = this.locks.get(executionId)!;
    const lockKey = `${key}:${ownerId}`;

    // Check if already locked by someone else
    for (const lock of locks) {
      if (lock.startsWith(`${key}:`) && !lock.endsWith(`:${ownerId}`)) {
        return false;
      }
    }

    locks.add(lockKey);
    
    logger.debug('Lock acquired', { executionId, key, ownerId });
    
    return true;
  }

  /**
   * Release lock on a key
   */
  releaseLock(executionId: string, key: string, ownerId: string): void {
    const locks = this.locks.get(executionId);
    
    if (!locks) {
      return;
    }

    const lockKey = `${key}:${ownerId}`;
    locks.delete(lockKey);

    logger.debug('Lock released', { executionId, key, ownerId });
  }

  /**
   * Check if key is locked
   */
  isLocked(executionId: string, key: string): boolean {
    const locks = this.locks.get(executionId);
    
    if (!locks) {
      return false;
    }

    for (const lock of locks) {
      if (lock.startsWith(`${key}:`)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Wait for key to become available
   */
  async waitForKey(
    executionId: string,
    key: string,
    timeoutMs: number = 30000
  ): Promise<any> {
    const startTime = Date.now();

    while (!this.has(executionId, key)) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`Timeout waiting for context key: ${key}`);
      }

      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return this.get(executionId, key);
  }

  /**
   * Subscribe to context changes
   */
  subscribe(
    executionId: string,
    key: string,
    callback: (value: any) => void
  ): () => void {
    const handler = (event: any) => {
      if (event.executionId === executionId && event.key === key) {
        callback(event.value);
      }
    };

    this.on('context:set', handler);

    // Return unsubscribe function
    return () => {
      this.off('context:set', handler);
    };
  }

  /**
   * Get context size
   */
  getSize(executionId: string): number {
    const contextData = this.contexts.get(executionId);
    return contextData ? contextData.size : 0;
  }

  /**
   * Cleanup expired values
   */
  cleanupExpired(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [executionId, contextData] of this.contexts.entries()) {
      for (const [key, value] of contextData.entries()) {
        if (value.expiresAt && value.expiresAt < now) {
          contextData.delete(key);
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up expired context values', { count: cleanedCount });
    }
  }

  /**
   * Get memory usage statistics
   */
  getStats(): {
    totalContexts: number;
    totalKeys: number;
    totalLocks: number;
  } {
    let totalKeys = 0;
    let totalLocks = 0;

    for (const contextData of this.contexts.values()) {
      totalKeys += contextData.size;
    }

    for (const locks of this.locks.values()) {
      totalLocks += locks.size;
    }

    return {
      totalContexts: this.contexts.size,
      totalKeys,
      totalLocks
    };
  }
}

// Singleton instance
export const sharedContextStore = new SharedContextStore();

// Cleanup expired values every 5 minutes
setInterval(() => {
  sharedContextStore.cleanupExpired();
}, 5 * 60 * 1000);
