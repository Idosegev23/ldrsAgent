/**
 * Institutional Communications & Data Agent
 * Agent #23 from the Multi-Agent System table
 * 
 * Uses LONG CONTEXT to:
 * 1. Translate data, decisions, and moves into clear institutional story
 * 2. Explain what happened, why it matters, how it impacts organization
 * 3. Create unified voice for management communication
 * 
 * Input: Data dumps, decisions, organizational updates
 * Output: Clear institutional communication with narrative
 */

import { BaseAgent } from '../../base-agent.js';
import type { Job, AgentResult } from '../../../types/job.types.js';
import type { Intent, AgentLayer } from '../../../types/agent.types.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class InstitutionalCommsAgent extends BaseAgent {
  id = 'operations/institutional';
  name = 'Institutional Communications Agent';
  nameHebrew = 'סוכן תקשורת מוסדית';
  layer: AgentLayer = 2;
  domain = 'operations';
  capabilities = [
    'analyze_institutional_data',
    'generate_reports',
    'prepare_communications',
    'track_compliance',
  ];
  description = 'מנהל תקשורת מוסדית וניתוח נתונים למוסדיים';
  requiresKnowledge = true;
  
  // Agent #23 - Uses LONG CONTEXT
  protected geminiTools: GeminiTool[] = [];

  canHandle(intent: Intent): boolean {
    const keywords = ['מוסדי', 'דוח', 'תקשורת', 'ציות', 'institutional', 'report', 'compliance'];
    const text = `${intent.category} ${intent.action} ${intent.entities.join(' ')}`.toLowerCase();
    return keywords.some((kw) => text.includes(kw));
  }

  async execute(job: Job): Promise<AgentResult> {
    this.log.info('Processing institutional communications', { jobId: job.id });

    const knowledgeContext = this.buildKnowledgeContext(job);
    const prompt = `אתה מומחה לתקשורת מוסדית וניתוח נתונים.

## משימה
${job.input}

## ידע רלוונטי
${knowledgeContext}

## הנחיות
1. נתח את הנתונים והמידע הזמין
2. הכן תקשורת מקצועית ומדויקת
3. ודא עמידה בסטנדרטים מוסדיים
4. הצג את המידע בצורה ברורה ומובנית

## פורמט תשובה
- סיכום מנהלים
- נתונים מרכזיים
- ניתוח והמלצות
- נקודות לתשומת לב

כתוב בעברית, בשפה מקצועית ורשמית.`;

    try {
      const response = await this.callLLM(prompt, 'writing');
      const citations = this.extractCitations(job);

      return this.success(response, {
        citations,
        confidence: job.knowledgePack.ready ? 'high' : 'medium',
        structured: {
          type: 'institutional_communication',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.log.error('Failed to process institutional communications', error as Error);
      return this.failure('שגיאה בעיבוד תקשורת מוסדית');
    }
  }
}
