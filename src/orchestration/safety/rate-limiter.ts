/**
 * Rate Limiter
 * Manages API rate limits and request throttling
 */

import type { RateLimit, RateLimitStatus } from '../../types/monitoring.types.js';
import { logger } from '../../utils/logger.js';

export class RateLimiter {
  private limits: Map<string, RateLimit>;

  // Define limits per integration
  private readonly limitDefinitions: Record<string, Record<string, { limit: number; window: number }>> = {
    drive: {
      search: { limit: 100, window: 60 }, // 100 per minute
      read: { limit: 100, window: 60 }
    },
    gmail: {
      send: { limit: 100, window: 86400 }, // 100 per day
      read: { limit: 250, window: 1 }
    },
    calendar: {
      create: { limit: 50, window: 60 },
      read: { limit: 100, window: 60 }
    },
    gemini: {
      generate: { limit: 60, window: 60 } // 60 per minute
    }
  };

  constructor() {
    this.limits = new Map();
  }

  /**
   * Check if request is allowed
   */
  checkLimit(integration: string, operation: string): boolean {
    const key = `${integration}:${operation}`;
    const limit = this.limits.get(key);

    if (!limit) {
      // Initialize limit
      const definition = this.limitDefinitions[integration]?.[operation];
      
      if (!definition) {
        // No limit defined, allow
        return true;
      }

      this.initializeLimit(integration, operation, definition.limit, definition.window);
      return true;
    }

    // Check if window expired
    const now = new Date();
    if (now >= limit.resetAt) {
      // Reset window
      limit.currentCount = 0;
      limit.resetAt = new Date(now.getTime() + limit.window * 1000);
    }

    // Check if within limit
    if (limit.currentCount >= limit.limit) {
      logger.warn('Rate limit exceeded', {
        integration,
        operation,
        limit: limit.limit,
        currentCount: limit.currentCount
      });
      return false;
    }

    // Increment counter
    limit.currentCount++;
    
    return true;
  }

  /**
   * Initialize limit
   */
  private initializeLimit(
    integration: string,
    operation: string,
    limit: number,
    window: number
  ): void {
    const key = `${integration}:${operation}`;
    const now = new Date();

    const rateLimit: RateLimit = {
      integration,
      operation,
      limit,
      window,
      currentCount: 0,
      resetAt: new Date(now.getTime() + window * 1000)
    };

    this.limits.set(key, rateLimit);
  }

  /**
   * Get rate limit status
   */
  getStatus(integration: string, operation: string): RateLimitStatus {
    const key = `${integration}:${operation}`;
    const limit = this.limits.get(key);

    if (!limit) {
      return {
        limited: false,
        currentUsage: 0,
        limit: Infinity
      };
    }

    const now = new Date();
    const limited = limit.currentCount >= limit.limit && now < limit.resetAt;

    return {
      limited,
      retryAfter: limited ? Math.ceil((limit.resetAt.getTime() - now.getTime()) / 1000) : undefined,
      currentUsage: limit.currentCount,
      limit: limit.limit
    };
  }

  /**
   * Enqueue request
   */
  async enqueue(request: any): Promise<void> {
    // TODO: Implement request queue
    logger.debug('Request enqueued', { request });
  }

  /**
   * Process queue
   */
  async processQueue(): Promise<void> {
    // TODO: Implement queue processing
  }

  /**
   * Retry with exponential backoff
   */
  async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 5
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if it's a rate limit error
        if (!this.isRateLimitError(lastError)) {
          throw lastError;
        }

        if (attempt < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
          logger.info('Rate limit hit, retrying', {
            attempt: attempt + 1,
            delayMs: delay
          });
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Check if error is rate limit error
   */
  private isRateLimitError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('rate limit') || 
           message.includes('too many requests') ||
           message.includes('429');
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get all limits
   */
  getAllLimits(): RateLimit[] {
    return Array.from(this.limits.values());
  }

  /**
   * Reset all limits
   */
  reset(): void {
    this.limits.clear();
    logger.info('All rate limits reset');
  }
}

export const rateLimiter = new RateLimiter();
