/**
 * Multichannel Communications Agent
 * Agent #24, #25 from the Multi-Agent System table
 * 
 * Uses LONG CONTEXT to:
 * 1. Define central message and adapt to different channels
 * 2. Keep communication unified even when format changes
 * 3. Track dialogue across platforms, identify deviations
 * 4. Enable timely responses to inconsistencies
 * 
 * Input: Gmail/WhatsApp/ClickUp communication history
 * Output: Unified message with channel-specific adaptations
 */

import { BaseAgent } from '../../base-agent.js';
import type { Job, AgentResult } from '../../../types/job.types.js';
import type { Intent, AgentLayer } from '../../../types/agent.types.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class MultichannelCommsAgent extends BaseAgent {
  id = 'sales/multichannel';
  name = 'Multichannel Communications Agent';
  nameHebrew = 'סוכן תקשורת רב-ערוצית';
  layer: AgentLayer = 2;
  domain = 'sales';
  capabilities = [
    'track_communications',
    'unify_customer_history',
    'generate_context_summary',
    'suggest_next_action',
  ];
  description = 'עוקב אחרי תקשורת רב-ערוצית עם לקוחות ומאחד את ההיסטוריה';
  requiresKnowledge = true;
  
  // Agent #24, #25 - Uses LONG CONTEXT
  protected geminiTools: GeminiTool[] = [];

  canHandle(intent: Intent): boolean {
    const keywords = ['תקשורת', 'ערוץ', 'מעקב', 'היסטוריה', 'multichannel', 'communication', 'track'];
    const text = `${intent.category} ${intent.action} ${intent.entities.join(' ')}`.toLowerCase();
    return keywords.some((kw) => text.includes(kw));
  }

  async execute(job: Job): Promise<AgentResult> {
    this.log.info('Processing multichannel communications', { jobId: job.id });

    const knowledgeContext = this.buildKnowledgeContext(job);
    const prompt = `אתה מומחה לניהול תקשורת רב-ערוצית עם לקוחות.

## משימה
${job.input}

## ידע רלוונטי
${knowledgeContext}

## הנחיות
1. אחד את כל נקודות המגע עם הלקוח
2. זהה את הערוצים הפעילים (מייל, וואטסאפ, טלפון, פגישות)
3. צור ציר זמן של האינטראקציות
4. הצע את הפעולה הבאה המומלצת

## פורמט תשובה
- סיכום היסטוריית התקשורת
- ערוצים פעילים
- נקודות מפתח מהשיחות
- המלצה לפעולה הבאה

כתוב בעברית, בצורה מסודרת וברורה.`;

    try {
      const response = await this.callLLM(prompt, 'reasoning');
      const citations = this.extractCitations(job);

      return this.success(response, {
        citations,
        confidence: job.knowledgePack.ready ? 'high' : 'medium',
        structured: {
          type: 'multichannel_summary',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.log.error('Failed to process multichannel communications', error as Error);
      return this.failure('שגיאה בעיבוד תקשורת רב-ערוצית');
    }
  }
}
