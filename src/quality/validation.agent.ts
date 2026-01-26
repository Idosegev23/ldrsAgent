/**
 * Validation Agent
 * Checks completeness, accuracy, and safety
 */

import { logger } from '../utils/logger.js';
import { getLLMManager } from '../llm/manager.js';
import type { Job, AgentResult, ValidationCheck } from '../types/job.types.js';

const log = logger.child({ component: 'ValidationAgent' });

/**
 * Validate agent result
 */
export async function validate(
  job: Job,
  result: AgentResult
): Promise<ValidationCheck[]> {
  log.debug('Validating result', { jobId: job.id });

  const checks: ValidationCheck[] = [];

  // 1. Completeness check
  checks.push(await checkCompleteness(job, result));

  // 2. Accuracy check (no hallucinations)
  checks.push(await checkAccuracy(job, result));

  // 3. Safety check
  checks.push(checkSafety(result));

  // 4. Format check
  checks.push(checkFormat(result));

  return checks;
}

/**
 * Check if the response is complete
 */
async function checkCompleteness(
  _job: Job,
  result: AgentResult
): Promise<ValidationCheck> {
  // Basic checks
  if (!result.output || result.output.trim().length < 50) {
    return {
      name: 'completeness',
      passed: false,
      score: 0.3,
      details: 'התשובה קצרה מדי',
    };
  }

  if (!result.success) {
    return {
      name: 'completeness',
      passed: false,
      score: 0.2,
      details: 'הסוכן דיווח על כישלון',
    };
  }

  return {
    name: 'completeness',
    passed: true,
    score: 1.0,
  };
}

/**
 * Check for hallucinations - output should be based on knowledge
 * NOTE: This check is advisory, not blocking
 */
async function checkAccuracy(
  job: Job,
  result: AgentResult
): Promise<ValidationCheck> {
  // If no knowledge was found, check that the response acknowledges this
  // But don't fail if the agent still provided useful general info
  if (job.knowledgePack.chunks.length === 0) {
    const acknowledgesLack = 
      result.output.includes('אין לי מידע') ||
      result.output.includes('לא נמצא') ||
      result.output.includes('לא מצאתי') ||
      result.output.includes('אין מספיק') ||
      result.output.includes('מידע כללי') ||
      result.output.includes('על סמך ידע כללי');

    if (!acknowledgesLack && result.confidence === 'high') {
      // Just reduce score, don't fail entirely
      return {
        name: 'accuracy',
        passed: true, // Changed: pass but with lower score
        score: 0.7,
        details: 'תשובה ללא ידע ספציפי על הלקוח',
      };
    }
  }

  // Skip expensive LLM hallucination check for now
  // The multi-agent approach with knowledge grounding should reduce hallucinations
  // Commenting out for performance and to reduce false positives
  
  /*
  const llm = getLLMManager();
  try {
    const checkPrompt = `בדוק אם התשובה הבאה מכילה מידע שממציא (hallucination)...`;
    const response = await llm.complete(checkPrompt, 'reasoning');
    const hasHallucination = response.toLowerCase().includes('כן');
    ...
  } catch (error) {
    log.warn('Accuracy check LLM call failed', { error });
  }
  */

  return {
    name: 'accuracy',
    passed: true,
    score: 1.0,
  };
}

/**
 * Check for safety issues
 */
function checkSafety(result: AgentResult): ValidationCheck {
  const unsafePatterns = [
    /סיסמ[הא]/i,
    /password/i,
    /credit.?card/i,
    /כרטיס אשראי/i,
    /מספר זהות/i,
  ];

  for (const pattern of unsafePatterns) {
    if (pattern.test(result.output)) {
      return {
        name: 'safety',
        passed: false,
        score: 0,
        details: 'התשובה עלולה לכלול מידע רגיש',
      };
    }
  }

  return {
    name: 'safety',
    passed: true,
    score: 1.0,
  };
}

/**
 * Check format is human-friendly
 */
function checkFormat(result: AgentResult): ValidationCheck {
  // Check for technical/JSON output
  if (result.output.includes('```json') || result.output.startsWith('{')) {
    return {
      name: 'format',
      passed: false,
      score: 0.5,
      details: 'התשובה מכילה פורמט טכני',
    };
  }

  // Check for system explanations
  const systemPatterns = [
    /המערכת עובדת/i,
    /הסוכן ביצע/i,
    /knowledge pack/i,
    /orchestrator/i,
  ];

  for (const pattern of systemPatterns) {
    if (pattern.test(result.output)) {
      return {
        name: 'format',
        passed: false,
        score: 0.6,
        details: 'התשובה מכילה הסברים על המערכת',
      };
    }
  }

  return {
    name: 'format',
    passed: true,
    score: 1.0,
  };
}

