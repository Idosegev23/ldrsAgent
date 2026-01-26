/**
 * useExecutionStream Hook
 * React hook for SSE streaming
 */

import { useEffect, useState, useRef } from 'react';
import type { StreamEvent } from '@backend/types/orchestration.types';

export interface StreamState {
  connected: boolean;
  events: StreamEvent[];
  latestEvent?: StreamEvent;
  error?: string;
}

export function useExecutionStream(executionId: string | null) {
  const [state, setState] = useState<StreamState>({
    connected: false,
    events: []
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!executionId) {
      return;
    }

    // Create EventSource
    const eventSource = new EventSource(`/api/orchestrate/stream/${executionId}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('Stream connected:', executionId);
      setState(prev => ({ ...prev, connected: true }));
    };

    eventSource.onerror = (error) => {
      console.error('Stream error:', error);
      setState(prev => ({
        ...prev,
        connected: false,
        error: 'Connection lost'
      }));
    };

    // Listen to all event types
    const eventTypes = [
      'progress',
      'log',
      'partial_result',
      'error',
      'complete',
      'approval_required',
      'step_started',
      'step_completed'
    ];

    eventTypes.forEach(eventType => {
      eventSource.addEventListener(eventType, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const event: StreamEvent = {
            type: eventType as any,
            executionId,
            timestamp: new Date(data.timestamp || Date.now()),
            data
          };

          setState(prev => ({
            ...prev,
            events: [...prev.events, event],
            latestEvent: event
          }));
        } catch (error) {
          console.error('Failed to parse event:', error);
        }
      });
    });

    // Cleanup
    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [executionId]);

  return state;
}
