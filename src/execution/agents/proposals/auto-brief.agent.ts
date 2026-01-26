/**
 * Client Auto Brief Form Agent
 * Agent #33 from the Multi-Agent System table
 * 
 * Uses LONG CONTEXT to:
 * 1. Make brief filling user-friendly and digital
 * 2. Auto-route brief to relevant people for execution
 * 3. Create professional and accessible interface
 * 
 * Input: Conversations, documents, client info
 * Output: Structured brief form with auto-routing
 */

import { BaseAgent } from '../../base-agent.js';
import type { Job, AgentResult } from '../../../types/job.types.js';
import type { Intent, AgentLayer } from '../../../types/agent.types.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class AutoBriefFormAgent extends BaseAgent {
  id = 'proposals/auto-brief';
  name = 'Client Auto Brief Form Agent';
  nameHebrew = 'סוכן בריף אוטומטי';
  layer: AgentLayer = 2;
  domain = 'proposals';
  capabilities = [
    'extract_brief_info',
    'generate_structured_brief',
    'identify_missing_info',
    'suggest_questions',
  ];
  description = 'מייצר בריף לקוח אוטומטי מתוך שיחות ומידע';
  requiresKnowledge = true;
  
  // Agent #33 - Uses LONG CONTEXT
  protected geminiTools: GeminiTool[] = [];

  canHandle(intent: Intent): boolean {
    const keywords = ['בריף', 'טופס', 'לקוח', 'brief', 'form', 'client', 'auto'];
    const text = `${intent.category} ${intent.action} ${intent.entities.join(' ')}`.toLowerCase();
    return keywords.some((kw) => text.includes(kw));
  }

  async execute(job: Job): Promise<AgentResult> {
    this.log.info('Generating auto brief', { jobId: job.id });

    const knowledgeContext = this.buildKnowledgeContext(job);
    const prompt = `אתה מומחה ליצירת בריפים ללקוחות.

## משימה
${job.input}

## ידע רלוונטי
${knowledgeContext}

## הנחיות
1. חלץ את כל המידע הרלוונטי מהשיחה/מידע
2. מלא את שדות הבריף הסטנדרטיים
3. זהה מידע חסר
4. הצע שאלות להשלמה

## מבנה בריף
- שם הלקוח/מותג
- תחום פעילות
- קהל יעד
- מטרות הקמפיין
- תקציב (אם ידוע)
- לוחות זמנים
- ערוצים מועדפים
- מסרים מרכזיים
- מתחרים
- הערות נוספות

## פורמט תשובה
- בריף מלא (מה שידוע)
- שדות חסרים
- שאלות מומלצות להשלמה

כתוב בעברית, בצורה מסודרת ומקצועית.`;

    try {
      const response = await this.callLLM(prompt, 'reasoning');
      const citations = this.extractCitations(job);

      return this.success(response, {
        citations,
        confidence: job.knowledgePack.ready ? 'high' : 'medium',
        structured: {
          type: 'client_brief',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.log.error('Failed to generate auto brief', error as Error);
      return this.failure('שגיאה ביצירת בריף אוטומטי');
    }
  }
}
