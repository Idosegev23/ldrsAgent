/**
 * General Assistant Agent
 * Handles general questions and unknown intents
 */

import { BaseAgent } from '../../base-agent.js';
import type { Job, AgentResult } from '../../../types/job.types.js';
import type { Intent, AgentLayer } from '../../../types/agent.types.js';

export class GeneralAssistantAgent extends BaseAgent {
  id = 'general/assistant';
  name = 'General Assistant Agent';
  nameHebrew = 'עוזר כללי';
  layer: AgentLayer = 2;
  domain = 'general';
  capabilities = ['answer-questions', 'provide-guidance', 'summarize'];
  description = 'עונה על שאלות כלליות ומספק הכוונה';

  canHandle(intent: Intent): boolean {
    return (
      intent.primary === 'general_question' ||
      intent.primary === 'unknown'
    );
  }

  getConfidence(intent: Intent): number {
    // Lower confidence for unknown - try to match other agents first
    if (intent.primary === 'unknown') return 0.3;
    return 0.7;
  }

  async execute(job: Job): Promise<AgentResult> {
    this.log.info('Executing general assistant', { jobId: job.id });

    const knowledgeContext = this.buildKnowledgeContext(job);
    const hasKnowledge = job.knowledgePack.chunks.length > 0;

    const prompt = `אתה עוזר מקצועי בסוכנות שיווק.

## השאלה:
${job.rawInput}

## מידע רלוונטי שנמצא:
${knowledgeContext}

## הנחיות:
1. ענה בצורה ישירה ומועילה
2. אם יש לך מידע - השתמש בו
3. אם אין לך מידע - אמור את זה בכנות
4. אל תמציא
5. הצע עזרה נוספת אם רלוונטי
6. כתוב בעברית

התשובה צריכה להיות אנושית וטבעית, לא טכנית.`;

    try {
      const response = await this.callLLM(prompt, 'writing');
      const citations = this.extractCitations(job);

      return this.success(response, {
        citations,
        confidence: hasKnowledge ? 'medium' : 'low',
      });

    } catch (error) {
      this.log.error('General assistant failed', error as Error);
      return this.failure('לא הצלחתי לעבד את הבקשה. נסה שוב.');
    }
  }
}

