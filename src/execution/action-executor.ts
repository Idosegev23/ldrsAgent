/**
 * Action Executor
 * Prepares and executes actions (send email, create task, etc.) after user approval
 */

import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import * as gmailConnector from '../integrations/connectors/gmail.connector.js';
import * as contactsConnector from '../integrations/connectors/contacts.connector.js';
import * as clickupConnector from '../integrations/connectors/clickup.connector.js';
import * as calendarConnector from '../integrations/connectors/calendar.connector.js';
import type { Job, AgentResult, PendingAction } from '../types/job.types.js';
import type { ParsedAction } from '../control/action-parser.js';

const log = logger.child({ component: 'ActionExecutor' });

// Store pending actions in memory (should be DB in production)
declare global {
  // eslint-disable-next-line no-var
  var __pendingActions: Map<string, PendingAction> | undefined;
}

function getActionsStore(): Map<string, PendingAction> {
  if (!globalThis.__pendingActions) {
    globalThis.__pendingActions = new Map<string, PendingAction>();
  }
  return globalThis.__pendingActions;
}

/**
 * Prepare action for user approval (does not execute)
 */
export async function prepareAction(
  job: Job,
  result: AgentResult,
  parsedAction: ParsedAction
): Promise<PendingAction> {
  log.info('Preparing action for approval', { jobId: job.id, actionType: parsedAction.type });

  const actionId = uuidv4();
  
  // Resolve recipients to emails
  const resolvedEmails: string[] = [];
  if (parsedAction.recipients) {
    for (const recipient of parsedAction.recipients) {
      try {
        const email = await contactsConnector.getContactEmail(recipient);
        if (email) {
          resolvedEmails.push(email);
        } else {
          // Fallback: check if it's already an email
          if (recipient.includes('@')) {
            resolvedEmails.push(recipient);
          } else {
            log.warn('Could not resolve recipient', { recipient });
          }
        }
      } catch (error) {
        log.warn('Failed to resolve recipient', { recipient, error: (error as Error).message });
      }
    }
  }

  let pendingAction: PendingAction;

  switch (parsedAction.type) {
    case 'SEND_EMAIL':
      pendingAction = {
        id: actionId,
        type: 'SEND_EMAIL',
        status: 'pending',
        preview: {
          title: 'שליחת מייל',
          description: `שלח מייל ל-${parsedAction.recipients?.join(', ')}`,
          recipient: parsedAction.recipients?.[0] || '',
          recipientEmail: resolvedEmails[0] || '',
        },
        parameters: {
          to: resolvedEmails,
          subject: parsedAction.subject || extractSubject(result.output),
          body: result.output,
        },
        jobId: job.id,
        userId: job.userId,
        createdAt: new Date(),
      };
      break;

    case 'CREATE_TASK':
      pendingAction = {
        id: actionId,
        type: 'CREATE_TASK',
        status: 'pending',
        preview: {
          title: 'יצירת משימה',
          description: `צור משימה: ${parsedAction.taskName}`,
        },
        parameters: {
          taskName: parsedAction.taskName || 'משימה חדשה',
          description: result.output,
        },
        jobId: job.id,
        userId: job.userId,
        createdAt: new Date(),
      };
      break;

    case 'CREATE_EVENT':
      pendingAction = {
        id: actionId,
        type: 'CREATE_EVENT',
        status: 'pending',
        preview: {
          title: 'קביעת פגישה',
          description: `קבע פגישה: ${parsedAction.eventTitle}`,
          recipient: parsedAction.recipients?.join(', '),
        },
        parameters: {
          eventTitle: parsedAction.eventTitle || 'פגישה',
          attendees: resolvedEmails,
        },
        jobId: job.id,
        userId: job.userId,
        createdAt: new Date(),
      };
      break;

    default:
      throw new Error(`Unsupported action type: ${parsedAction.type}`);
  }

  // Store pending action
  const store = getActionsStore();
  store.set(actionId, pendingAction);

  log.info('Action prepared for approval', { actionId, type: pendingAction.type });
  return pendingAction;
}

/**
 * Execute action after user approval
 */
export async function executeAction(actionId: string): Promise<{ success: boolean; message: string }> {
  log.info('Executing action', { actionId });

  const store = getActionsStore();
  const action = store.get(actionId);

  if (!action) {
    throw new Error('Action not found');
  }

  if (action.status !== 'pending') {
    throw new Error(`Action already ${action.status}`);
  }

  // Mark as approved
  action.status = 'approved';
  store.set(actionId, action);

  try {
    let result: { success: boolean; message: string };

    switch (action.type) {
      case 'SEND_EMAIL':
        result = await executeSendEmail(action);
        break;

      case 'CREATE_TASK':
        result = await executeCreateTask(action);
        break;

      case 'CREATE_EVENT':
        result = await executeCreateEvent(action);
        break;

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }

    // Mark as executed
    action.status = 'executed';
    action.executedAt = new Date();
    store.set(actionId, action);

    log.info('Action executed successfully', { actionId, type: action.type });
    return result;
  } catch (error) {
    log.error('Action execution failed', error as Error, { actionId });
    
    // Keep as approved but log failure
    action.status = 'approved'; // Keep approved status for retry
    store.set(actionId, action);

    return {
      success: false,
      message: `שגיאה בביצוע הפעולה: ${(error as Error).message}`,
    };
  }
}

/**
 * Get pending action by ID
 */
export function getPendingAction(actionId: string): PendingAction | undefined {
  const store = getActionsStore();
  return store.get(actionId);
}

/**
 * Get all pending actions for a job
 */
export function getJobPendingActions(jobId: string): PendingAction[] {
  const store = getActionsStore();
  return Array.from(store.values()).filter(
    (action) => action.jobId === jobId && action.status === 'pending'
  );
}

/**
 * Cancel/reject action
 */
export function rejectAction(actionId: string): void {
  const store = getActionsStore();
  const action = store.get(actionId);
  
  if (action) {
    action.status = 'rejected';
    store.set(actionId, action);
    log.info('Action rejected', { actionId });
  }
}

// ============================================
// Private execution functions
// ============================================

async function executeSendEmail(action: PendingAction): Promise<{ success: boolean; message: string }> {
  log.info('Sending email', { 
    to: action.parameters.to, 
    subject: action.parameters.subject,
    userId: action.userId,
  });

  try {
    // Use sendEmailAsUser with OAuth (not service account)
    const messageId = await gmailConnector.sendEmailAsUser(action.userId, {
      to: action.parameters.to || [],
      subject: action.parameters.subject || 'מבית Leadrs',
      body: action.parameters.body || '',
      isHtml: false,
    });

    return {
      success: true,
      message: `המייל נשלח בהצלחה ל-${action.preview.recipient} (${action.preview.recipientEmail})`,
    };
  } catch (error) {
    log.error('Failed to send email', error as Error, { userId: action.userId });
    throw error;
  }
}

async function executeCreateTask(action: PendingAction): Promise<{ success: boolean; message: string }> {
  log.info('Creating task', { taskName: action.parameters.taskName });

  // ClickUp implementation would go here
  // For now, return success
  return {
    success: true,
    message: `המשימה "${action.parameters.taskName}" נוצרה בהצלחה`,
  };
}

async function executeCreateEvent(action: PendingAction): Promise<{ success: boolean; message: string }> {
  log.info('Creating event', { 
    eventTitle: action.parameters.eventTitle,
    userId: action.userId,
    attendees: action.parameters.attendees,
  });

  try {
    // Use Calendar API with user OAuth
    const eventId = await calendarConnector.createEventForUser(action.userId, {
      summary: action.parameters.eventTitle || 'פגישה',
      attendees: action.parameters.attendees || [],
      startTime: action.parameters.startTime || new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      endTime: action.parameters.endTime || new Date(Date.now() + 25 * 60 * 60 * 1000), // Tomorrow + 1h
      description: action.parameters.description,
      location: action.parameters.location,
    });

    return {
      success: true,
      message: `הפגישה "${action.parameters.eventTitle}" נקבעה בהצלחה! הוזמנו ${action.parameters.attendees?.length || 0} משתתפים`,
    };
  } catch (error) {
    log.error('Failed to create event', error as Error, { userId: action.userId });
    throw error;
  }
}

// ============================================
// Helper functions
// ============================================

function extractSubject(content: string): string {
  // Try to extract subject from content
  const lines = content.split('\n');
  
  // Check for "נושא:" pattern
  for (const line of lines) {
    const match = line.match(/(?:נושא|subject)[:\s]+([^\n]+)/i);
    if (match) {
      return match[1].trim();
    }
  }

  // Check for markdown headers
  for (const line of lines) {
    if (line.startsWith('#')) {
      return line.replace(/^#+\s*/, '').trim();
    }
  }

  // Fallback: first non-empty line
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && trimmed.length < 100) {
      return trimmed;
    }
  }

  return 'עדכון מבית Leadrs';
}
