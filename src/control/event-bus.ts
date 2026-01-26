/**
 * Event Bus
 * Simple pub/sub for system events
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import type { EventType, SystemEvent, EventHandler } from '../types/event.types.js';

const log = logger.child({ component: 'EventBus' });

type HandlerFn<T = Record<string, unknown>> = (event: SystemEvent<T>) => Promise<void>;

class EventBus {
  private handlers: Map<EventType, HandlerFn[]> = new Map();

  /**
   * Subscribe to an event type
   */
  on<T = Record<string, unknown>>(
    eventType: EventType,
    handler: HandlerFn<T>
  ): () => void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler as HandlerFn);
    this.handlers.set(eventType, handlers);

    // Return unsubscribe function
    return () => {
      const current = this.handlers.get(eventType) || [];
      this.handlers.set(
        eventType,
        current.filter((h) => h !== handler)
      );
    };
  }

  /**
   * Emit an event
   */
  async emit<T = Record<string, unknown>>(
    type: EventType,
    payload: T,
    context: { userId: string; clientId?: string; jobId?: string }
  ): Promise<void> {
    const event: SystemEvent<T> = {
      id: uuidv4(),
      type,
      userId: context.userId,
      clientId: context.clientId,
      jobId: context.jobId,
      payload,
      timestamp: new Date(),
    };

    log.debug('Event emitted', { type, eventId: event.id });

    const handlers = this.handlers.get(type) || [];
    
    // Execute all handlers concurrently
    await Promise.allSettled(
      handlers.map(async (handler) => {
        try {
          await handler(event as SystemEvent);
        } catch (error) {
          log.error('Event handler failed', error as Error, {
            type,
            eventId: event.id,
          });
        }
      })
    );
  }

  /**
   * Register an event handler object
   */
  register(handler: EventHandler): () => void {
    const eventTypes = Array.isArray(handler.eventType)
      ? handler.eventType
      : [handler.eventType];

    const unsubscribes = eventTypes.map((type) =>
      this.on(type, handler.handle.bind(handler))
    );

    return () => unsubscribes.forEach((unsub) => unsub());
  }

  /**
   * Clear all handlers (for testing)
   */
  clear(): void {
    this.handlers.clear();
  }
}

// Singleton instance
let eventBus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!eventBus) {
    eventBus = new EventBus();
  }
  return eventBus;
}

export { EventBus };

