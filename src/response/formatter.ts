/**
 * Response Formatter
 * Formats agent output for human consumption
 */

import { logger } from '../utils/logger.js';
import type { Job, AgentResult } from '../types/job.types.js';

const log = logger.child({ component: 'ResponseFormatter' });

/**
 * Format response for output
 * Ensures human-first, no JSON, no system explanations
 */
export function formatResponse(result: AgentResult, job: Job): string {
  log.debug('Formatting response', { jobId: job.id });

  let output = result.output;

  // Remove any JSON blocks
  output = output.replace(/```json[\s\S]*?```/g, '');
  output = output.replace(/```[\s\S]*?```/g, '');

  // Remove system explanations
  output = output.replace(/\[.*?\]/g, ''); // [citations]
  output = output.replace(/\(מקור:.*?\)/g, ''); // (source: ...)

  // Clean up extra whitespace
  output = output.replace(/\n{3,}/g, '\n\n');
  output = output.trim();

  // If output is empty after cleaning, provide fallback
  if (!output) {
    log.warn('Output empty after cleaning', { jobId: job.id });
    return 'לא הצלחתי לעבד את הבקשה כראוי. נסה לנסח אחרת.';
  }

  return output;
}

/**
 * Format for WhatsApp (shorter, with emojis stripped)
 */
export function formatForWhatsApp(result: AgentResult, job: Job): string {
  let output = formatResponse(result, job);

  // Remove emojis per user preference
  output = output.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
    ''
  );

  // Truncate if too long for WhatsApp
  if (output.length > 4000) {
    output = output.slice(0, 3950) + '\n\n[התשובה קוצרה]';
  }

  return output;
}

/**
 * Format for email (can be longer, with signature)
 */
export function formatForEmail(
  result: AgentResult,
  job: Job,
  subject?: string
): { subject: string; body: string } {
  const output = formatResponse(result, job);

  return {
    subject: subject || `תשובה לבקשה: ${job.rawInput.slice(0, 50)}...`,
    body: output,
  };
}

/**
 * Format for CLI (with debug info if needed)
 */
export function formatForCLI(
  result: AgentResult,
  job: Job,
  debug: boolean = false
): string {
  let output = formatResponse(result, job);

  if (debug) {
    output += '\n\n---\n';
    output += `[Debug]\n`;
    output += `Job ID: ${job.id}\n`;
    output += `Intent: ${job.intent?.primary || 'N/A'}\n`;
    output += `Agent: ${job.assignedAgent || 'N/A'}\n`;
    output += `Confidence: ${result.confidence}\n`;
    output += `Knowledge: ${job.knowledgePack?.chunks?.length || 0} chunks\n`;
  }

  return output;
}

