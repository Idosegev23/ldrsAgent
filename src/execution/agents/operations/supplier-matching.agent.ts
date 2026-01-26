/**
 * Supplier Matching Agent
 * Agent #21 from the Multi-Agent System table
 * 
 * Uses LONG CONTEXT to:
 * 1. Analyze project requirements
 * 2. Cross-reference with supplier characteristics
 * 3. Suggest precise match, not just "who's available"
 * 
 * Input: Project requirements, Supplier database
 * Output: Ranked supplier recommendations with fit scores
 */

import { BaseAgent } from '../../base-agent.js';
import type { Job, AgentResult } from '../../../types/job.types.js';
import type { Intent, AgentLayer } from '../../../types/agent.types.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class SupplierMatchingAgent extends BaseAgent {
  id = 'operations/supplier-matching';
  name = 'Supplier Matching Agent';
  nameHebrew = 'סוכן התאמת ספקים';
  layer: AgentLayer = 2;
  domain = 'operations';
  capabilities = [
    'match_suppliers',
    'evaluate_fit',
    'compare_options',
    'suggest_alternatives',
  ];
  description = 'מתאים ספקים מתוך מאגר לדרישות הפרויקט';
  requiresKnowledge = true;
  
  // Agent #21 - Uses LONG CONTEXT
  protected geminiTools: GeminiTool[] = [];

  canHandle(intent: Intent): boolean {
    const keywords = ['ספק', 'התאמה', 'מאגר', 'supplier', 'match', 'vendor'];
    const text = `${intent.category} ${intent.action} ${intent.entities.join(' ')}`.toLowerCase();
    return keywords.some((kw) => text.includes(kw));
  }

  async execute(job: Job): Promise<AgentResult> {
    this.log.info('Matching suppliers', { jobId: job.id });

    const knowledgeContext = this.buildKnowledgeContext(job);
    const prompt = `אתה מומחה להתאמת ספקים לפרויקטים.

## משימה
${job.input}

## ידע רלוונטי (מאגר ספקים)
${knowledgeContext}

## הנחיות
1. הבן את דרישות הפרויקט
2. חפש ספקים מתאימים במאגר
3. דרג את ההתאמה
4. הצע אלטרנטיבות

## פורמט תשובה
- דרישות הפרויקט (סיכום)
- ספקים מומלצים (מדורגים)
  - שם הספק
  - התמחות
  - ציון התאמה
  - הערות
- אלטרנטיבות
- המלצה סופית

כתוב בעברית, בצורה מעשית וברורה.`;

    try {
      const response = await this.callLLM(prompt, 'reasoning');
      const citations = this.extractCitations(job);

      return this.success(response, {
        citations,
        confidence: job.knowledgePack.ready ? 'high' : 'low',
        structured: {
          type: 'supplier_matching',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.log.error('Failed to match suppliers', error as Error);
      return this.failure('שגיאה בהתאמת ספקים');
    }
  }
}
