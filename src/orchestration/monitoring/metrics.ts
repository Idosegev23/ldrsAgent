/**
 * Metrics Collector
 * Collects and aggregates performance metrics
 */

import type { Metric, AggregatedMetrics, TimeRange } from '../../types/monitoring.types.js';
import { logger } from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class MetricsCollector {
  private metrics: Metric[];

  constructor() {
    this.metrics = [];
  }

  /**
   * Record duration
   */
  recordDuration(operation: string, ms: number, tags?: Record<string, string>): void {
    this.record('duration', operation, ms, 'ms', tags);
  }

  /**
   * Record success
   */
  recordSuccess(operation: string, tags?: Record<string, string>): void {
    this.record('success', operation, 1, 'count', tags);
  }

  /**
   * Record failure
   */
  recordFailure(operation: string, error: Error, tags?: Record<string, string>): void {
    this.record('failure', operation, 1, 'count', {
      ...tags,
      error: error.message
    });
  }

  /**
   * Record execution count
   */
  recordExecutionCount(): void {
    this.record('execution', 'count', 1, 'count');
  }

  /**
   * Record tokens used
   */
  recordTokensUsed(count: number, tags?: Record<string, string>): void {
    this.record('tokens', 'used', count, 'tokens', tags);
  }

  /**
   * Record agent usage
   */
  recordAgentUsage(agentId: string): void {
    this.record('agent', 'usage', 1, 'count', { agentId });
  }

  /**
   * Record metric
   */
  private record(
    name: string,
    subname: string,
    value: number,
    unit?: string,
    tags?: Record<string, string>
  ): void {
    const metric: Metric = {
      id: uuidv4(),
      name: `${name}.${subname}`,
      value,
      unit,
      tags: tags || {},
      timestamp: new Date()
    };

    this.metrics.push(metric);

    // Keep only last 10000 metrics
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-10000);
    }
  }

  /**
   * Get metrics
   */
  getMetrics(timeRange: TimeRange): Metric[] {
    return this.metrics.filter(m =>
      m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
    );
  }

  /**
   * Get aggregated metrics
   */
  getAggregated(
    metricName: string,
    timeRange: TimeRange,
    aggregation: 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT'
  ): AggregatedMetrics {
    const relevantMetrics = this.getMetrics(timeRange).filter(m => m.name === metricName);

    let value = 0;

    switch (aggregation) {
      case 'SUM':
        value = relevantMetrics.reduce((sum, m) => sum + m.value, 0);
        break;
      case 'AVG':
        value = relevantMetrics.length > 0
          ? relevantMetrics.reduce((sum, m) => sum + m.value, 0) / relevantMetrics.length
          : 0;
        break;
      case 'MIN':
        value = relevantMetrics.length > 0
          ? Math.min(...relevantMetrics.map(m => m.value))
          : 0;
        break;
      case 'MAX':
        value = relevantMetrics.length > 0
          ? Math.max(...relevantMetrics.map(m => m.value))
          : 0;
        break;
      case 'COUNT':
        value = relevantMetrics.length;
        break;
    }

    return {
      metric: metricName,
      timeRange,
      aggregation,
      value,
      dataPoints: relevantMetrics.map(m => ({
        timestamp: m.timestamp,
        value: m.value,
        tags: m.tags
      }))
    };
  }

  /**
   * Clear old metrics
   */
  cleanup(olderThan: Date): void {
    const before = this.metrics.length;
    this.metrics = this.metrics.filter(m => m.timestamp >= olderThan);
    const cleaned = before - this.metrics.length;

    if (cleaned > 0) {
      logger.info('Metrics cleaned', { count: cleaned });
    }
  }
}

export const metricsCollector = new MetricsCollector();

// Cleanup every hour
setInterval(() => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  metricsCollector.cleanup(oneDayAgo);
}, 60 * 60 * 1000);
