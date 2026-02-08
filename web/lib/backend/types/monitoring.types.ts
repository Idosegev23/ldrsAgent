/**
 * Monitoring and Observability Types
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  id: string;
  executionId?: string;
  source: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface LogFilters {
  executionId?: string;
  source?: string;
  level?: LogLevel;
  startTime?: Date;
  endTime?: Date;
  query?: string;
}

// Distributed Tracing
export interface Trace {
  id: string;
  executionId: string;
  rootSpanId: string;
  spans: Span[];
  startedAt: Date;
  endedAt?: Date;
  durationMs?: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
}

export interface Span {
  id: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  type: 'STEP' | 'API_CALL' | 'LLM_CALL' | 'DATABASE' | 'CACHE';
  startedAt: Date;
  endedAt?: Date;
  durationMs?: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  metadata?: Record<string, any>;
  tags?: Record<string, string>;
}

export interface TraceTree {
  rootSpan: SpanNode;
  totalDurationMs: number;
  totalSpans: number;
}

export interface SpanNode {
  span: Span;
  children: SpanNode[];
}

// Metrics
export interface Metric {
  id: string;
  name: string;
  value: number;
  unit?: string;
  tags: Record<string, string>;
  timestamp: Date;
}

export type MetricType = 
  | 'COUNTER'
  | 'GAUGE'
  | 'HISTOGRAM'
  | 'SUMMARY';

export interface MetricDefinition {
  name: string;
  type: MetricType;
  description: string;
  unit?: string;
  tags: string[];
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface AggregatedMetrics {
  metric: string;
  timeRange: TimeRange;
  aggregation: 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT';
  value: number;
  dataPoints: DataPoint[];
}

export interface DataPoint {
  timestamp: Date;
  value: number;
  tags?: Record<string, string>;
}

// Health and Status
export interface HealthStatus {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  components: ComponentHealth[];
  checkedAt: Date;
}

export interface ComponentHealth {
  name: string;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  message?: string;
  lastCheck: Date;
  metadata?: Record<string, any>;
}

// Rate Limiting
export interface RateLimit {
  integration: string;
  operation: string;
  limit: number;
  window: number; // seconds
  currentCount: number;
  resetAt: Date;
}

export interface RateLimitStatus {
  limited: boolean;
  retryAfter?: number; // seconds
  currentUsage: number;
  limit: number;
}
