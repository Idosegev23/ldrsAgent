/**
 * Customer Satisfaction Agent
 * Agent #14 from the Multi-Agent System table
 * 
 * Uses LONG CONTEXT to:
 * 1. Collect and analyze feedback, responses, and emotional patterns
 * 2. Understand true satisfaction, not just general feelings
 * 3. Generate improvement recommendations
 * 
 * Input: ClickUp/Gmail customer feedback, survey responses
 * Output: Satisfaction analysis with actionable insights
 */

import { BaseAgent } from '../../base-agent.js';
import type { Job, AgentResult } from '../../../types/job.types.js';
import type { Intent, AgentLayer } from '../../../types/agent.types.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class CustomerSatisfactionAgent extends BaseAgent {
  id = 'sales/customer-satisfaction';
  name = 'Customer Satisfaction Agent';
  nameHebrew = 'סוכן שביעות רצון לקוחות';
  layer: AgentLayer = 2;
  domain = 'sales';
  capabilities = [
    'analyze_customer_feedback',
    'identify_satisfaction_trends',
    'generate_improvement_recommendations',
    'track_nps_scores',
  ];
  description = 'מנתח משובי לקוחות ומזהה מגמות שביעות רצון';
  requiresKnowledge = true;
  
  // Agent #14 - Uses LONG CONTEXT
  protected geminiTools: GeminiTool[] = [];

  canHandle(intent: Intent): boolean {
    const keywords = ['שביעות רצון', 'לקוח', 'משוב', 'nps', 'satisfaction', 'feedback', 'customer'];
    const text = `${intent.category} ${intent.action} ${intent.entities.join(' ')}`.toLowerCase();
    return keywords.some((kw) => text.includes(kw));
  }

  async execute(job: Job): Promise<AgentResult> {
    this.log.info('Analyzing customer satisfaction', { jobId: job.id });

    const knowledgeContext = this.buildKnowledgeContext(job);
    const prompt = `אתה מומחה לניתוח שביעות רצון לקוחות.

## משימה
${job.input}

## ידע רלוונטי
${knowledgeContext}

## הנחיות
1. נתח את המשובים והנתונים הזמינים
2. זהה מגמות חיוביות ושליליות
3. הצע פעולות שיפור קונקרטיות
4. תן ציון כללי לשביעות הרצון (1-10)

## פורמט תשובה
- סיכום מצב נוכחי
- נקודות חוזק
- נקודות לשיפור
- המלצות פעולה
- ציון כללי

כתוב בעברית, בצורה מקצועית וברורה.`;

    try {
      const response = await this.callLLM(prompt, 'reasoning');
      const citations = this.extractCitations(job);

      return this.success(response, {
        citations,
        confidence: job.knowledgePack.ready ? 'high' : 'medium',
        structured: {
          type: 'customer_satisfaction_analysis',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.log.error('Failed to analyze customer satisfaction', error as Error);
      return this.failure('שגיאה בניתוח שביעות רצון לקוחות');
    }
  }
}
