/**
 * Stream Manager
 * Manages SSE streams for real-time execution updates
 */

import { EventEmitter } from 'events';
import type {
  StreamEvent,
  ProgressEvent,
  LogEvent
} from '../../types/orchestration.types.js';
import { logger } from '../../utils/logger.js';

export class StreamManager {
  private streams: Map<string, EventEmitter>;

  constructor() {
    this.streams = new Map();
  }

  /**
   * Create stream for execution
   */
  createStream(executionId: string): EventEmitter {
    if (!this.streams.has(executionId)) {
      const emitter = new EventEmitter();
      emitter.setMaxListeners(100); // Support many concurrent listeners
      this.streams.set(executionId, emitter);

      logger.debug('Stream created', { executionId });
    }

    return this.streams.get(executionId)!;
  }

  /**
   * Get existing stream
   */
  getStream(executionId: string): EventEmitter | undefined {
    return this.streams.get(executionId);
  }

  /**
   * Emit progress event
   */
  emitProgress(
    executionId: string,
    progress: ProgressEvent
  ): void {
    const stream = this.getStream(executionId);
    
    if (stream) {
      const event: StreamEvent = {
        type: 'progress',
        executionId,
        timestamp: new Date(),
        data: progress
      };

      stream.emit('event', event);
      stream.emit('progress', progress);
    }
  }

  /**
   * Emit log event
   */
  emitLog(
    executionId: string,
    log: LogEvent
  ): void {
    const stream = this.getStream(executionId);
    
    if (stream) {
      const event: StreamEvent = {
        type: 'log',
        executionId,
        timestamp: new Date(),
        data: log
      };

      stream.emit('event', event);
      stream.emit('log', log);
    }
  }

  /**
   * Emit partial result
   */
  emitPartialResult(
    executionId: string,
    data: any
  ): void {
    const stream = this.getStream(executionId);
    
    if (stream) {
      const event: StreamEvent = {
        type: 'partial_result',
        executionId,
        timestamp: new Date(),
        data
      };

      stream.emit('event', event);
      stream.emit('partial_result', data);
    }
  }

  /**
   * Emit error event
   */
  emitError(
    executionId: string,
    error: Error
  ): void {
    const stream = this.getStream(executionId);
    
    if (stream) {
      const event: StreamEvent = {
        type: 'error',
        executionId,
        timestamp: new Date(),
        data: {
          message: error.message,
          stack: error.stack
        }
      };

      stream.emit('event', event);
      stream.emit('error', error);
    }
  }

  /**
   * Emit complete event
   */
  emitComplete(
    executionId: string,
    result: any
  ): void {
    const stream = this.getStream(executionId);
    
    if (stream) {
      const event: StreamEvent = {
        type: 'complete',
        executionId,
        timestamp: new Date(),
        data: result
      };

      stream.emit('event', event);
      stream.emit('complete', result);

      // Clean up after a delay
      setTimeout(() => {
        this.closeStream(executionId);
      }, 60000); // 1 minute
    }
  }

  /**
   * Emit step started event
   */
  emitStepStarted(
    executionId: string,
    stepNumber: number,
    stepName: string
  ): void {
    this.emitProgress(executionId, {
      stepNumber,
      stepName,
      status: 'RUNNING',
      message: `Starting ${stepName}...`
    });
  }

  /**
   * Emit step completed event
   */
  emitStepCompleted(
    executionId: string,
    stepNumber: number,
    stepName: string,
    durationMs: number
  ): void {
    this.emitProgress(executionId, {
      stepNumber,
      stepName,
      status: 'COMPLETED',
      progress: 1,
      message: `Completed ${stepName} (${durationMs}ms)`
    });
  }

  /**
   * Emit approval required event
   */
  emitApprovalRequired(
    executionId: string,
    approvalId: string,
    action: string
  ): void {
    const stream = this.getStream(executionId);
    
    if (stream) {
      const event: StreamEvent = {
        type: 'approval_required',
        executionId,
        timestamp: new Date(),
        data: {
          approvalId,
          action
        }
      };

      stream.emit('event', event);
      stream.emit('approval_required', { approvalId, action });
    }
  }

  /**
   * Close stream
   */
  closeStream(executionId: string): void {
    const stream = this.streams.get(executionId);
    
    if (stream) {
      stream.removeAllListeners();
      this.streams.delete(executionId);

      logger.debug('Stream closed', { executionId });
    }
  }

  /**
   * Get active streams count
   */
  getActiveStreamsCount(): number {
    return this.streams.size;
  }

  /**
   * Cleanup old streams
   */
  cleanup(): void {
    // In a real implementation, track stream creation time and cleanup
    logger.debug('Stream cleanup', {
      activeStreams: this.streams.size
    });
  }
}

// Singleton instance
export const streamManager = new StreamManager();

// Cleanup every 5 minutes
setInterval(() => {
  streamManager.cleanup();
}, 5 * 60 * 1000);
