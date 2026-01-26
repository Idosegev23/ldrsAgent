/**
 * Output Evaluator
 * Checks quality, tone, and professionalism
 */

import { logger } from '../utils/logger.js';
import { getLLMManager } from '../llm/manager.js';
import type { Job, AgentResult } from '../types/job.types.js';

const log = logger.child({ component: 'Evaluator' });

export interface EvaluationResult {
  passed: boolean;
  score: number;
  feedback?: string;
  aspects: {
    clarity: number;
    professionalism: number;
    relevance: number;
    tone: number;
  };
}

/**
 * Evaluate output quality
 */
export async function evaluate(
  job: Job,
  result: AgentResult
): Promise<EvaluationResult> {
  log.debug('Evaluating output', { jobId: job.id });

  const llm = getLLMManager();

  try {
    const evalPrompt = `הערך את איכות התשובה הבאה לבקשה.

הבקשה המקורית:
${job.rawInput}

התשובה:
${result.output}

הערך מ-0 עד 10:
1. בהירות - האם התשובה ברורה ומובנת?
2. מקצועיות - האם הטון מקצועי ומתאים?
3. רלוונטיות - האם התשובה עונה על הבקשה?
4. טון - האם הטון אנושי ולא שיווקי מדי?

החזר JSON בלבד:
{
  "clarity": 8,
  "professionalism": 9,
  "relevance": 7,
  "tone": 8,
  "feedback": "הערות קצרות אם יש"
}`;

    const response = await llm.generateStructured<{
      clarity: number;
      professionalism: number;
      relevance: number;
      tone: number;
      feedback?: string;
    }>(evalPrompt, {
      type: 'object',
      properties: {
        clarity: { type: 'number' },
        professionalism: { type: 'number' },
        relevance: { type: 'number' },
        tone: { type: 'number' },
        feedback: { type: 'string' },
      },
      required: ['clarity', 'professionalism', 'relevance', 'tone'],
    }, 'reasoning');

    const avgScore =
      (response.clarity +
        response.professionalism +
        response.relevance +
        response.tone) /
      4 /
      10;

    return {
      passed: avgScore >= 0.7,
      score: avgScore,
      feedback: response.feedback,
      aspects: {
        clarity: response.clarity / 10,
        professionalism: response.professionalism / 10,
        relevance: response.relevance / 10,
        tone: response.tone / 10,
      },
    };
  } catch (error) {
    log.warn('Evaluation LLM call failed', { error });

    // Fallback to basic evaluation
    return basicEvaluation(result);
  }
}

/**
 * Basic evaluation without LLM
 */
function basicEvaluation(result: AgentResult): EvaluationResult {
  const output = result.output;

  // Length check
  const lengthScore = Math.min(output.length / 500, 1);

  // Structure check
  const hasStructure =
    output.includes('\n') || output.includes(':') || output.includes('-');
  const structureScore = hasStructure ? 0.8 : 0.5;

  // Confidence mapping
  const confidenceScore =
    result.confidence === 'high' ? 0.9 :
    result.confidence === 'medium' ? 0.7 : 0.5;

  const avgScore = (lengthScore + structureScore + confidenceScore) / 3;

  return {
    passed: avgScore >= 0.6,
    score: avgScore,
    aspects: {
      clarity: lengthScore,
      professionalism: structureScore,
      relevance: confidenceScore,
      tone: 0.7,
    },
  };
}

