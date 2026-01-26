/**
 * Weekly Inspiration Agent
 * Agent #18 from the Multi-Agent System table
 * 
 * Uses GROUNDING (Search) to:
 * 1. Systematically scan international inspiration sources
 * 2. Filter noise and distill relevant campaigns/moves weekly
 * 3. Explain why it's interesting and how to learn from it
 * 
 * Input: Content sources, Industry focus
 * Output: Weekly inspiration email with curated content
 */

import { BaseAgent } from '../../base-agent.js';
import type { Job, AgentResult } from '../../../types/job.types.js';
import type { Intent, AgentLayer } from '../../../types/agent.types.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class WeeklyInspirationAgent extends BaseAgent {
  id = 'creative/weekly-inspiration';
  name = 'Weekly Inspiration Agent';
  nameHebrew = 'סוכן השראה שבועית';
  layer: AgentLayer = 2;
  domain = 'creative';
  capabilities = [
    'scan_content_sources',
    'curate_inspiration',
    'generate_newsletter',
    'identify_trends',
  ];
  description = 'סורק אתרי תוכן ומייצר מייל השראה שבועי לעובדים';
  requiresKnowledge = false;
  
  // Agent #18 - Uses GROUNDING (Search)
  protected geminiTools: GeminiTool[] = ['grounding'];

  canHandle(intent: Intent): boolean {
    const keywords = ['השראה', 'שבועי', 'ניוזלטר', 'מגמות', 'inspiration', 'weekly', 'newsletter', 'trends'];
    const text = `${intent.category} ${intent.action} ${intent.entities.join(' ')}`.toLowerCase();
    return keywords.some((kw) => text.includes(kw));
  }

  async execute(job: Job): Promise<AgentResult> {
    this.log.info('Generating weekly inspiration', { jobId: job.id });

    const knowledgeContext = this.buildKnowledgeContext(job);
    const prompt = `אתה עורך תוכן יצירתי שמכין ניוזלטר השראה שבועי.

## משימה
${job.input}

## מידע נוסף
${knowledgeContext}

## הנחיות
1. אסוף 5-7 מהלכים/קמפיינים מעניינים מהשבוע האחרון
2. לכל מהלך: תיאור קצר, למה זה מעניין, מה אפשר ללמוד
3. הוסף מגמה אחת בולטת
4. סיים עם "שאלה לחשיבה" לצוות

## פורמט
כתוב בפורמט מייל מעוצב:
- כותרת מושכת
- פתיח קצר
- המהלכים (עם כותרות משנה)
- מגמת השבוע
- שאלה לחשיבה
- חתימה

כתוב בעברית, בטון קליל ומעורר השראה.`;

    try {
      const response = await this.callLLM(prompt, 'writing');
      const citations = this.extractCitations(job);

      return this.success(response, {
        citations,
        confidence: 'high',
        structured: {
          type: 'weekly_inspiration',
          format: 'newsletter',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.log.error('Failed to generate weekly inspiration', error as Error);
      return this.failure('שגיאה ביצירת ניוזלטר השראה');
    }
  }
}
