/**
 * Conflict Resolver
 * Handles resource conflicts and race conditions
 */

import type { ResourceLock, Conflict } from '../../types/orchestration.types.js';
import { logger } from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../db/client.js';

export class ConflictResolver {
  private locks: Map<string, ResourceLock>;
  private conflicts: Map<string, Conflict>;

  constructor() {
    this.locks = new Map();
    this.conflicts = new Map();
  }

  /**
   * Acquire lock on resource
   */
  async acquireLock(
    resource: string,
    agentId: string,
    durationMs: number = 60000
  ): Promise<boolean> {
    // Check if already locked
    if (this.locks.has(resource)) {
      const existingLock = this.locks.get(resource)!;
      
      // Check if lock expired
      if (existingLock.expiresAt > new Date()) {
        logger.debug('Resource locked by another agent', {
          resource,
          lockedBy: existingLock.lockedBy,
          requestedBy: agentId
        });
        return false;
      }

      // Lock expired, remove it
      this.locks.delete(resource);
    }

    // Acquire lock
    const lock: ResourceLock = {
      resourceId: resource,
      lockedBy: agentId,
      lockedAt: new Date(),
      expiresAt: new Date(Date.now() + durationMs)
    };

    this.locks.set(resource, lock);

    // Save to database
    try {
      await supabase
        .from('resource_locks')
        .upsert({
          resource_id: lock.resourceId,
          locked_by: lock.lockedBy,
          locked_at: lock.lockedAt.toISOString(),
          expires_at: lock.expiresAt.toISOString()
        });
    } catch (error) {
      logger.error('Failed to save lock', {
        resource,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    logger.debug('Lock acquired', {
      resource,
      agentId,
      expiresAt: lock.expiresAt
    });

    return true;
  }

  /**
   * Release lock
   */
  async releaseLock(resource: string, agentId: string): Promise<void> {
    const lock = this.locks.get(resource);
    
    if (!lock) {
      return;
    }

    if (lock.lockedBy !== agentId) {
      logger.warn('Cannot release lock owned by another agent', {
        resource,
        lockedBy: lock.lockedBy,
        requestedBy: agentId
      });
      return;
    }

    this.locks.delete(resource);

    // Delete from database
    try {
      await supabase
        .from('resource_locks')
        .delete()
        .eq('resource_id', resource);
    } catch (error) {
      logger.error('Failed to delete lock', {
        resource,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    logger.debug('Lock released', {
      resource,
      agentId
    });
  }

  /**
   * Detect conflict
   */
  detectConflict(action1: any, action2: any): Conflict | null {
    // TODO: Implement conflict detection logic
    return null;
  }

  /**
   * Resolve conflict
   */
  async resolveConflict(conflictId: string): Promise<void> {
    const conflict = this.conflicts.get(conflictId);
    
    if (!conflict) {
      throw new Error('Conflict not found');
    }

    // TODO: Implement conflict resolution strategies

    conflict.resolved = true;
    conflict.resolution = {
      strategy: 'SEQUENCE',
      appliedAt: new Date(),
      result: 'Conflict resolved by sequencing actions'
    };

    logger.info('Conflict resolved', {
      conflictId,
      strategy: conflict.resolution.strategy
    });
  }

  /**
   * Execute with transaction
   */
  async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
    // TODO: Implement transaction wrapper
    return fn();
  }

  /**
   * Cleanup expired locks
   */
  cleanupExpiredLocks(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [resource, lock] of this.locks.entries()) {
      if (lock.expiresAt < now) {
        this.locks.delete(resource);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned expired locks', { count: cleaned });
    }
  }

  /**
   * Get active locks
   */
  getActiveLocks(): ResourceLock[] {
    return Array.from(this.locks.values());
  }
}

export const conflictResolver = new ConflictResolver();

// Cleanup every minute
setInterval(() => {
  conflictResolver.cleanupExpiredLocks();
}, 60000);
