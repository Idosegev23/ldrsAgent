/**
 * Distributed Tracer
 * Trace execution steps and spans
 */

import type { Trace, Span, TraceTree, SpanNode } from '../../types/monitoring.types.js';
import { logger } from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class DistributedTracer {
  private traces: Map<string, Trace>;
  private spans: Map<string, Span>;

  constructor() {
    this.traces = new Map();
    this.spans = new Map();
  }

  /**
   * Start trace
   */
  startTrace(executionId: string): Trace {
    const trace: Trace = {
      id: uuidv4(),
      executionId,
      rootSpanId: '',
      spans: [],
      startedAt: new Date(),
      status: 'RUNNING'
    };

    this.traces.set(trace.id, trace);

    logger.debug('Trace started', { traceId: trace.id, executionId });

    return trace;
  }

  /**
   * Start span
   */
  startSpan(
    traceId: string,
    name: string,
    type: Span['type'],
    parentSpanId?: string
  ): Span {
    const span: Span = {
      id: uuidv4(),
      traceId,
      parentSpanId,
      name,
      type,
      startedAt: new Date(),
      status: 'RUNNING'
    };

    this.spans.set(span.id, span);

    const trace = this.traces.get(traceId);
    if (trace) {
      if (!trace.rootSpanId) {
        trace.rootSpanId = span.id;
      }
      trace.spans.push(span);
    }

    return span;
  }

  /**
   * End span
   */
  endSpan(spanId: string, result?: any): void {
    const span = this.spans.get(spanId);
    
    if (!span) {
      return;
    }

    span.endedAt = new Date();
    span.durationMs = span.endedAt.getTime() - span.startedAt.getTime();
    span.status = 'COMPLETED';

    if (result) {
      span.metadata = { result };
    }
  }

  /**
   * Get trace tree
   */
  getTraceTree(traceId: string): TraceTree | null {
    const trace = this.traces.get(traceId);
    
    if (!trace || !trace.rootSpanId) {
      return null;
    }

    const rootSpan = this.spans.get(trace.rootSpanId);
    
    if (!rootSpan) {
      return null;
    }

    const rootNode = this.buildSpanNode(rootSpan);
    const totalDurationMs = trace.durationMs || 0;

    return {
      rootSpan: rootNode,
      totalDurationMs,
      totalSpans: trace.spans.length
    };
  }

  /**
   * Build span node tree
   */
  private buildSpanNode(span: Span): SpanNode {
    const children: SpanNode[] = [];

    // Find child spans
    const childSpans = Array.from(this.spans.values())
      .filter(s => s.parentSpanId === span.id);

    for (const childSpan of childSpans) {
      children.push(this.buildSpanNode(childSpan));
    }

    return {
      span,
      children
    };
  }

  /**
   * Get trace
   */
  getTrace(traceId: string): Trace | undefined {
    return this.traces.get(traceId);
  }

  /**
   * End trace
   */
  endTrace(traceId: string): void {
    const trace = this.traces.get(traceId);
    
    if (!trace) {
      return;
    }

    trace.endedAt = new Date();
    trace.durationMs = trace.endedAt.getTime() - trace.startedAt.getTime();
    trace.status = 'COMPLETED';
  }
}

export const distributedTracer = new DistributedTracer();
