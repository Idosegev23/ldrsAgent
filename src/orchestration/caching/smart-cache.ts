/**
 * Smart Cache
 * Intelligent caching with semantic search
 */

import type { CacheEntry, CacheKey } from '../../types/orchestration.types.js';
import { logger } from '../../utils/logger.js';

export class SmartCache {
  private cache: Map<string, CacheEntry>;
  private defaultTTL: number = 3600; // 1 hour

  constructor() {
    this.cache = new Map();
  }

  /**
   * Get cached value
   */
  async get(key: CacheKey, ttl?: number): Promise<any | null> {
    const cacheKey = this.generateKey(key);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return null;
    }

    // Check expiration
    if (entry.expiresAt < new Date()) {
      this.cache.delete(cacheKey);
      logger.debug('Cache expired', { key: cacheKey });
      return null;
    }

    // Update hit count
    entry.hitCount++;
    entry.lastHitAt = new Date();

    logger.debug('Cache hit', { key: cacheKey, hitCount: entry.hitCount });
    
    return entry.value;
  }

  /**
   * Set cached value
   */
  async set(
    key: CacheKey,
    value: any,
    options?: { ttl?: number }
  ): Promise<void> {
    const cacheKey = this.generateKey(key);
    const ttl = options?.ttl || this.defaultTTL;

    const entry: CacheEntry = {
      key: cacheKey,
      value,
      ttlSeconds: ttl,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + ttl * 1000),
      hitCount: 0
    };

    this.cache.set(cacheKey, entry);

    logger.debug('Cache set', { key: cacheKey, ttl });
  }

  /**
   * Find similar cached entries
   */
  async findSimilar(query: string, threshold: number = 0.85): Promise<CacheEntry[]> {
    // TODO: Implement semantic similarity search
    // For now, return empty array
    return [];
  }

  /**
   * Get incremental update
   */
  async getIncremental(key: CacheKey, since: Date): Promise<any | null> {
    // TODO: Implement incremental caching
    return null;
  }

  /**
   * Invalidate cache
   */
  async invalidate(pattern: string): Promise<number> {
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }

    logger.info('Cache invalidated', { pattern, count });
    
    return count;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  /**
   * Generate cache key
   */
  private generateKey(key: CacheKey): string {
    const parts = [key.type, key.query];
    
    if (key.parameters) {
      parts.push(JSON.stringify(key.parameters));
    }

    return parts.join(':');
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cache cleanup', { cleaned });
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalEntries: number;
    totalHits: number;
    hitRate: number;
  } {
    let totalHits = 0;
    let totalRequests = 0;

    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount;
      totalRequests += entry.hitCount + 1; // +1 for initial set
    }

    return {
      totalEntries: this.cache.size,
      totalHits,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0
    };
  }
}

export const smartCache = new SmartCache();

// Cleanup every 5 minutes
setInterval(() => {
  smartCache.cleanup();
}, 5 * 60 * 1000);
