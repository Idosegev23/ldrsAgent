/**
 * Paid Media & Media Strategy Agent
 * Agent #9 from the Multi-Agent System table
 * 
 * Uses GROUNDING + CODE to:
 * 1. Search for current industry benchmarks (CPC/CPM) for target audience
 * 2. Use Python to calculate potential reach and budget allocation scenarios
 * 3. Connect business goals, target audiences, messages, and channels
 * 4. Create strategic framework before going live
 * 
 * Input: ClickUp Budget, Goals, Audience
 * Output: Media strategy with budget allocation and channel recommendations
 */

import { BaseAgent } from '../../base-agent.js';
import type { Job, AgentResult } from '../../../types/job.types.js';
import type { Intent, AgentLayer } from '../../../types/agent.types.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class MediaStrategyAgent extends BaseAgent {
  id = 'media/strategy';
  name = 'Media Strategy Agent';
  nameHebrew = 'סוכן אסטרטגיית מדיה';
  layer: AgentLayer = 2;
  domain = 'media';
  capabilities = [
    'build-strategy',
    'analyze-audience',
    'recommend-channels',
    'budget-allocation',
  ];
  description = 'בונה אסטרטגיות מדיה לפי יעדי העסק, קהל יעד, תקציב ותחרות';
  
  // Agent #9 - Uses GROUNDING + CODE EXECUTION
  protected geminiTools: GeminiTool[] = ['grounding', 'code_execution'];

  canHandle(intent: Intent): boolean {
    return intent.primary === 'media_strategy';
  }

  async execute(job: Job): Promise<AgentResult> {
    this.log.info('Executing media strategy', {
      jobId: job.id,
      clientName: job.intent.entities.clientName,
    });

    const knowledgeContext = this.buildKnowledgeContext(job);
    const hasKnowledge = job.knowledgePack.chunks.length > 0;

    const prompt = `אתה יועץ אסטרטגי בכיר לשיווק דיגיטלי.

## הבקשה:
${job.rawInput}

## ידע קיים על הלקוח:
${knowledgeContext}

## הנחיות:
1. התבסס רק על הידע שניתן לך
2. אם אין מספיק מידע - ציין את זה בבירור
3. אל תמציא נתונים
4. הצע כיוון אסטרטגי מנומק
5. השתמש בשפה מקצועית אך נגישה
6. כתוב בעברית

## מבנה התשובה:
${hasKnowledge ? `
1. סיכום מה אני יודע על הלקוח
2. המלצות אסטרטגיות
3. ערוצים מומלצים
4. הנחיות לביצוע
` : `
1. הסבר שאין לי מספיק מידע
2. מה אני צריך לדעת כדי לבנות אסטרטגיה
3. אם אפשר - כיוון כללי בזהירות
`}

כתוב תשובה אנושית, ישירה, ללא פורמט טכני.`;

    try {
      const response = await this.callLLM(prompt, 'reasoning');
      const citations = this.extractCitations(job);

      if (!hasKnowledge) {
        return this.needsReview(
          response,
          'אין מספיק ידע על הלקוח',
          { citations }
        );
      }

      return this.success(response, {
        citations,
        confidence: job.knowledgePack.confidence > 0.7 ? 'high' : 'medium',
      });

    } catch (error) {
      this.log.error('Media strategy failed', error as Error);
      return this.failure('לא הצלחתי לבנות אסטרטגיה. נסה שוב.');
    }
  }
}

