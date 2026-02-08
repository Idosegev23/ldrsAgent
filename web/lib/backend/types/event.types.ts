/**
 * Event Types
 * Event bus and system events
 */

export type EventType =
  | 'user.request'
  | 'whatsapp.incoming'
  | 'email.incoming'
  | 'calendar.upcoming'
  | 'calendar.created'
  | 'clickup.task.updated'
  | 'deal.stuck'
  | 'scheduled.morning'
  | 'scheduled.weekly'
  | 'ai.initiative'
  | 'job.created'
  | 'job.started'
  | 'job.completed'
  | 'job.failed'
  | 'knowledge.retrieved'
  | 'agent.executed'
  | 'validation.passed'
  | 'validation.failed';

export interface SystemEvent<T = Record<string, unknown>> {
  id: string;
  type: EventType;
  userId: string;
  clientId?: string;
  jobId?: string;
  payload: T;
  timestamp: Date;
}

export interface EventHandler<T = Record<string, unknown>> {
  eventType: EventType | EventType[];
  handle(event: SystemEvent<T>): Promise<void>;
}

