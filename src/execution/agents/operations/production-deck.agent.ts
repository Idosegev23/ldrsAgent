/**
 * Production Deck Generator Agent
 * Agent #12 from the Multi-Agent System table
 * 
 * Uses CODE (for Tables) + VISION to:
 * 1. Parse script text
 * 2. Break down into structured shooting schedule (Scene, Cast, Location, Props)
 * 3. Use Code to estimate timing based on word count/scene length
 * 
 * Input: Drive Script, Location List
 * Output: Complete production deck with schedule, budget, storyboard
 */

import { BaseAgent } from '../../base-agent.js';
import type { Job, AgentResult } from '../../../types/job.types.js';
import type { Intent, AgentLayer } from '../../../types/agent.types.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class ProductionDeckAgent extends BaseAgent {
  id = 'operations/production-deck';
  name = 'Production Deck Generator Agent';
  nameHebrew = 'סוכן מצגת הפקה';
  layer: AgentLayer = 2;
  domain = 'operations';
  capabilities = [
    'generate_production_deck',
    'plan_locations',
    'define_art_direction',
    'budget_breakdown',
    'shooting_script',
    'timing-estimation',
  ];
  description = 'מייצר מצגת הפקה מלאה: לוקיישנים, ארט, צוות, תקציב, תסריט';
  requiresKnowledge = true;
  
  // Agent #12 - Uses CODE (for Tables) + VISION
  protected geminiTools: GeminiTool[] = ['code_execution'];

  canHandle(intent: Intent): boolean {
    const keywords = ['מצגת הפקה', 'הפקה', 'לוקיישן', 'צילום', 'production', 'deck', 'shooting'];
    const text = `${intent.category} ${intent.action} ${intent.entities.join(' ')}`.toLowerCase();
    return keywords.some((kw) => text.includes(kw));
  }

  async execute(job: Job): Promise<AgentResult> {
    this.log.info('Generating production deck', { jobId: job.id });

    const knowledgeContext = this.buildKnowledgeContext(job);
    const prompt = `אתה מפיק מנוסה שמכין מצגות הפקה מקצועיות.

## משימה
${job.input}

## ידע רלוונטי
${knowledgeContext}

## הנחיות
צור מצגת הפקה מלאה הכוללת:

1. **סקירה כללית**
   - שם הפרויקט
   - לקוח
   - מטרות
   - תאריכים

2. **קונספט ואסטרטגיה**
   - רעיון מרכזי
   - מסרים
   - טון ואווירה

3. **לוקיישנים**
   - אפשרויות מומלצות
   - יתרונות וחסרונות
   - עלויות משוערות

4. **כיוון אמנותי (Art Direction)**
   - סגנון ויזואלי
   - צבעים
   - רפרנסים

5. **צוות**
   - תפקידים נדרשים
   - המלצות לאנשי מקצוע

6. **תקציב**
   - פירוט עלויות
   - סה"כ

7. **לוח זמנים**
   - Pre-production
   - Production
   - Post-production

8. **Shooting Script / סטורי בורד**
   - רצף סצנות
   - תיאור כל שוט

כתוב בעברית, בפורמט מצגת מקצועית.`;

    try {
      const response = await this.callLLM(prompt, 'writing');
      const citations = this.extractCitations(job);

      return this.success(response, {
        citations,
        confidence: job.knowledgePack.ready ? 'high' : 'medium',
        structured: {
          type: 'production_deck',
          format: 'presentation',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.log.error('Failed to generate production deck', error as Error);
      return this.failure('שגיאה ביצירת מצגת הפקה');
    }
  }
}
