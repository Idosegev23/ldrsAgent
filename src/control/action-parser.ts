/**
 * Action Parser
 * Identifies actionable requests in user input (send email, create task, etc.)
 */

import { logger } from '../utils/logger.js';

const log = logger.child({ component: 'ActionParser' });

export type ActionType = 
  | 'SEND_EMAIL'
  | 'CREATE_TASK'
  | 'CREATE_EVENT'
  | 'UPDATE_TASK'
  | 'NONE';

export interface ParsedAction {
  type: ActionType;
  recipients?: string[];
  subject?: string;
  eventTitle?: string;
  taskName?: string;
  parameters?: Record<string, any>;
  confidence: number;
}

/**
 * Parse user input to detect actionable requests
 */
export function parseActions(input: string): ParsedAction[] {
  log.info('Parsing actions from input', { inputLength: input.length });

  const actions: ParsedAction[] = [];
  const lowerInput = input.toLowerCase();

  // Detect SEND_EMAIL
  const emailAction = detectEmailAction(input, lowerInput);
  if (emailAction) {
    actions.push(emailAction);
  }

  // Detect CREATE_TASK
  const taskAction = detectTaskAction(input, lowerInput);
  if (taskAction) {
    actions.push(taskAction);
  }

  // Detect CREATE_EVENT
  const eventAction = detectEventAction(input, lowerInput);
  if (eventAction) {
    actions.push(eventAction);
  }

  if (actions.length === 0) {
    actions.push({ type: 'NONE', confidence: 1.0 });
  }

  log.info('Actions parsed', { actionCount: actions.length, types: actions.map(a => a.type) });
  return actions;
}

/**
 * Detect email sending action
 */
function detectEmailAction(input: string, lowerInput: string): ParsedAction | null {
  const emailPatterns = [
    // Hebrew patterns - more flexible
    /(?:ו)?(?:שלח|תשלח|שלחי|לשלוח)\s+(?:את\s+)?(?:זה\s+)?(?:מייל|אימייל|email|הודעה)?\s*(?:ל|אל)[:\s-]*([א-תa-zA-Z\s,]+)/i,
    /(?:ו)?(?:שלח|תשלח|שלחי|לשלוח)\s+(?:על\s+)?(?:זה\s+)?(?:מייל|אימייל|email|הודעה)\s+(?:ל|אל)[:\s-]*([א-תa-zA-Z\s,]+)/i,
    /(?:מייל|email)\s+(?:ל|אל|to)[:\s-]*([א-תa-zA-Z\s,]+)/i,
    /(?:send|email)\s+(?:to|this to)\s+([a-zA-Z\s,]+)/i,
  ];

  for (const pattern of emailPatterns) {
    const match = input.match(pattern);
    if (match) {
      let recipientsRaw = match[1].trim();
      
      // Clean up - remove trailing words that aren't names
      recipientsRaw = recipientsRaw.replace(/\s+(בדגשים|על|עם|ו|,).*$/i, '');
      
      const recipients = recipientsRaw
        .split(/[,\s]+(?:ו|and|,)\s*/i)
        .map(r => r.trim())
        .filter(r => r.length > 0 && r.length < 30); // Reasonable name length

      if (recipients.length === 0) continue;

      // Extract subject if mentioned
      let subject: string | undefined;
      const subjectMatch = input.match(/(?:נושא|subject)[:\s]+([^\n]+)/i);
      if (subjectMatch) {
        subject = subjectMatch[1].trim();
      }

      log.info('Email action detected', { pattern: pattern.toString(), recipients });

      return {
        type: 'SEND_EMAIL',
        recipients,
        subject,
        confidence: 0.9,
      };
    }
  }

  return null;
}

/**
 * Detect task creation action
 */
function detectTaskAction(input: string, lowerInput: string): ParsedAction | null {
  const taskPatterns = [
    /(?:צור|תצור|יצירת|ליצור)\s+(?:משימה|task)(?:\s+של)?\s*[:\s-]*([^\n]+)/i,
    /(?:create|add)\s+(?:a\s+)?task\s*[:\s-]*([^\n]+)/i,
  ];

  for (const pattern of taskPatterns) {
    const match = input.match(pattern);
    if (match) {
      const taskName = match[1].trim().split(/[,.\n]/)[0]; // First sentence

      return {
        type: 'CREATE_TASK',
        taskName,
        confidence: 0.85,
      };
    }
  }

  return null;
}

/**
 * Detect event/meeting creation action
 */
function detectEventAction(input: string, lowerInput: string): ParsedAction | null {
  const eventPatterns = [
    /(?:תזמן|זמן|קבע|תקבע)\s+(?:פגישה|meeting|אירוע|event)(?:\s+עם)?\s*[:\s-]*([^\n]+)/i,
    /(?:schedule|create)\s+(?:a\s+)?(?:meeting|event)\s+(?:with\s+)?([^\n]+)/i,
  ];

  for (const pattern of eventPatterns) {
    const match = input.match(pattern);
    if (match) {
      const details = match[1].trim();
      
      // Extract attendees
      const recipients = details
        .split(/[,\s]+(?:ו|and|,)\s*/i)
        .map(r => r.trim())
        .filter(r => r.length > 0 && r.length < 50); // Reasonable name length

      return {
        type: 'CREATE_EVENT',
        recipients,
        eventTitle: details.split(/[,.\n]/)[0], // First part as title
        confidence: 0.8,
      };
    }
  }

  return null;
}

/**
 * Check if input contains any actionable request
 */
export function hasActions(input: string): boolean {
  const actions = parseActions(input);
  return actions.some(a => a.type !== 'NONE');
}

/**
 * Extract main action type (highest confidence)
 */
export function getMainAction(input: string): ParsedAction {
  const actions = parseActions(input).filter(a => a.type !== 'NONE');
  
  if (actions.length === 0) {
    return { type: 'NONE', confidence: 1.0 };
  }

  // Return highest confidence action
  return actions.reduce((prev, current) => 
    current.confidence > prev.confidence ? current : prev
  );
}
