/**
 * Production Budget Check Agent
 * Checks production budgets and suggests cost optimizations
 */

import { BaseAgent } from '../../base-agent.js';
import type { Job, AgentResult } from '../../../types/job.types.js';
import type { Intent, AgentLayer } from '../../../types/agent.types.js';

export class ProductionBudgetAgent extends BaseAgent {
  id = 'operations/production-budget';
  name = 'Production Budget Check Agent';
  nameHebrew = 'סוכן בדיקת תקציב הפקות';
  layer: AgentLayer = 2;
  domain = 'operations';
  capabilities = [
    'analyze_budget',
    'compare_costs',
    'suggest_savings',
    'validate_estimates',
  ];
  description = 'בודק תקציבי הפקות ומציע חיסכון על בסיס נתונים היסטוריים';
  requiresKnowledge = true;

  canHandle(intent: Intent): boolean {
    const keywords = ['תקציב', 'הפקה', 'עלות', 'חיסכון', 'budget', 'production', 'cost'];
    const text = `${intent.category} ${intent.action} ${intent.entities.join(' ')}`.toLowerCase();
    return keywords.some((kw) => text.includes(kw));
  }

  async execute(job: Job): Promise<AgentResult> {
    this.log.info('Checking production budget', { jobId: job.id });

    const knowledgeContext = this.buildKnowledgeContext(job);
    const prompt = `אתה מומחה לניהול תקציבי הפקות.

## משימה
${job.input}

## ידע רלוונטי (נתונים היסטוריים)
${knowledgeContext}

## הנחיות
1. נתח את התקציב המוצע
2. השווה לעלויות היסטוריות דומות
3. זהה פריטים יקרים מדי
4. הצע אלטרנטיבות חיסכון

## פורמט תשובה
- סיכום התקציב המוצע
- השוואה לפרויקטים דומים
- פריטים לבדיקה (יקרים מהרגיל)
- הצעות חיסכון ספציפיות
- תקציב מומלץ מעודכן
- אישור/דחייה עם נימוק

כתוב בעברית, עם מספרים ונתונים ברורים.`;

    try {
      const response = await this.callLLM(prompt, 'reasoning');
      const citations = this.extractCitations(job);

      return this.success(response, {
        citations,
        confidence: job.knowledgePack.ready ? 'high' : 'medium',
        structured: {
          type: 'budget_analysis',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.log.error('Failed to check production budget', error as Error);
      return this.failure('שגיאה בבדיקת תקציב הפקה');
    }
  }
}
