/**
 * Log Aggregator
 * Centralized log collection and search
 */

import type { LogEntry, LogLevel, LogFilters } from '../../types/monitoring.types.js';
import { logger as baseLogger } from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class LogAggregator {
  private logs: LogEntry[];
  private maxLogs: number = 10000;

  constructor() {
    this.logs = [];
  }

  /**
   * Collect log
   */
  collect(
    source: string,
    level: LogLevel,
    message: string,
    meta?: Record<string, any>,
    executionId?: string
  ): void {
    const entry: LogEntry = {
      id: uuidv4(),
      executionId,
      source,
      level,
      message,
      metadata: meta,
      timestamp: new Date()
    };

    this.logs.push(entry);

    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  /**
   * Search logs
   */
  search(query: string, filters?: LogFilters): LogEntry[] {
    let results = [...this.logs];

    // Apply filters
    if (filters) {
      if (filters.executionId) {
        results = results.filter(log => log.executionId === filters.executionId);
      }

      if (filters.source) {
        results = results.filter(log => log.source === filters.source);
      }

      if (filters.level) {
        results = results.filter(log => log.level === filters.level);
      }

      if (filters.startTime) {
        results = results.filter(log => log.timestamp >= filters.startTime!);
      }

      if (filters.endTime) {
        results = results.filter(log => log.timestamp <= filters.endTime!);
      }
    }

    // Apply query
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(log =>
        log.message.toLowerCase().includes(lowerQuery) ||
        log.source.toLowerCase().includes(lowerQuery)
      );
    }

    return results;
  }

  /**
   * Real-time tail
   */
  async *tail(executionId: string): AsyncIterableIterator<LogEntry> {
    const lastIndex = this.logs.length;

    while (true) {
      const newLogs = this.logs
        .slice(lastIndex)
        .filter(log => log.executionId === executionId);

      for (const log of newLogs) {
        yield log;
      }

      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Export logs
   */
  export(executionId: string, format: 'json' | 'text'): string {
    const logs = this.search('', { executionId });

    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    // Text format
    return logs
      .map(log => {
        const timestamp = log.timestamp.toISOString();
        const level = log.level.padEnd(5);
        const source = log.source.padEnd(20);
        return `[${timestamp}] ${level} ${source} ${log.message}`;
      })
      .join('\n');
  }

  /**
   * Get logs for execution
   */
  getExecutionLogs(executionId: string): LogEntry[] {
    return this.logs.filter(log => log.executionId === executionId);
  }

  /**
   * Clear logs
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalLogs: number;
    byLevel: Record<LogLevel, number>;
  } {
    const byLevel: Record<LogLevel, number> = {
      DEBUG: 0,
      INFO: 0,
      WARN: 0,
      ERROR: 0
    };

    for (const log of this.logs) {
      byLevel[log.level]++;
    }

    return {
      totalLogs: this.logs.length,
      byLevel
    };
  }
}

export const logAggregator = new LogAggregator();
