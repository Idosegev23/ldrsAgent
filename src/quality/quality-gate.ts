/**
 * Quality Gate
 * Runs validation and evaluation in strict order
 * 
 * Order: Validation → Evaluator → (Auto-Fix if failed) → Response
 */

import { logger } from '../utils/logger.js';
import { validate } from './validation.agent.js';
import { evaluate } from './evaluator.agent.js';
import type { Job, AgentResult, ValidationResult } from '../types/job.types.js';

const log = logger.child({ component: 'QualityGate' });

export interface QualityGateResult {
  passed: boolean;
  validationResult: ValidationResult;
  needsFix: boolean;
}

/**
 * Run the full quality gate
 * 
 * Strict order:
 * 1. Validation Agent - checks completeness, accuracy, safety
 * 2. Output Evaluator - checks quality, tone, professionalism
 * 
 * If any step fails, returns with needsFix=true
 * Auto-Fix happens in Orchestrator, NOT here
 */
export async function runQualityGate(
  job: Job,
  result: AgentResult
): Promise<QualityGateResult> {
  log.info('Running quality gate', { jobId: job.id });

  // 1. Validation
  log.debug('Running validation');
  const validationChecks = await validate(job, result);

  const overallScore =
    validationChecks.reduce((sum, c) => sum + c.score, 0) / validationChecks.length;

  // Get critical checks (safety is critical, others are advisory)
  const safetyCheck = validationChecks.find((c) => c.name === 'safety');
  const safetyPassed = safetyCheck?.passed ?? true;
  
  // Calculate weighted pass threshold:
  // - Must pass safety check
  // - Overall score >= 0.6 (more lenient than 0.7)
  // - Or at least 3/4 checks passed
  const passedCount = validationChecks.filter((c) => c.passed).length;
  const validationPassed = safetyPassed && (overallScore >= 0.6 || passedCount >= 3);

  const validationResult: ValidationResult = {
    passed: validationPassed,
    checks: validationChecks,
    overallScore,
    feedback: validationPassed
      ? undefined
      : validationChecks
          .filter((c) => !c.passed)
          .map((c) => c.details)
          .join('; '),
  };

  if (!validationResult.passed) {
    log.warn('Validation failed', {
      jobId: job.id,
      score: overallScore,
      passedCount,
      failedChecks: validationChecks.filter((c) => !c.passed).map((c) => c.name),
    });

    return {
      passed: false,
      validationResult,
      needsFix: true,
    };
  }

  // 2. Evaluation
  log.debug('Running evaluation');
  const evaluationResult = await evaluate(job, result);

  if (!evaluationResult.passed) {
    log.warn('Evaluation failed', {
      jobId: job.id,
      score: evaluationResult.score,
    });

    // Add evaluation feedback to validation result
    validationResult.feedback = evaluationResult.feedback;
    validationResult.passed = false;

    return {
      passed: false,
      validationResult,
      needsFix: true,
    };
  }

  log.info('Quality gate passed', {
    jobId: job.id,
    validationScore: overallScore,
    evaluationScore: evaluationResult.score,
  });

  return {
    passed: true,
    validationResult,
    needsFix: false,
  };
}

