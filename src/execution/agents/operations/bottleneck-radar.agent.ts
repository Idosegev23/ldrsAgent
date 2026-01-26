/**
 * Ops Bottleneck Radar Agent
 * Agent #32 from the Multi-Agent System table
 * 
 * Uses CODE EXECUTION to:
 * 1. Load task logs (JSON)
 * 2. Calculate "Average Time to Complete" per team member
 * 3. Identify statistical outliers (bottlenecks)
 * 4. Correlate delays with specific project types
 * 
 * Input: ClickUp Task Logs (JSON)
 * Output: Bottleneck analysis with outliers and correlations
 */

import { BaseAgent } from '../../base-agent.js';
import type { Job, AgentResult } from '../../../types/job.types.js';
import type { Intent, AgentLayer } from '../../../types/agent.types.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class BottleneckRadarAgent extends BaseAgent {
  id = 'operations/bottleneck-radar';
  name = 'Ops Bottleneck Radar Agent';
  nameHebrew = 'סוכן איתור צווארי בקבוק';
  layer: AgentLayer = 2;
  domain = 'operations';
  capabilities = [
    'identify_bottlenecks',
    'analyze_workload',
    'predict_delays',
    'suggest_solutions',
  ];
  description = 'מזהה עומסים וצווארי בקבוק תפעוליים';
  requiresKnowledge = true;
  
  // Agent #32 - Uses CODE EXECUTION (Python/pandas)
  protected geminiTools: GeminiTool[] = ['code_execution'];

  canHandle(intent: Intent): boolean {
    const keywords = ['צוואר בקבוק', 'עומס', 'עיכוב', 'bottleneck', 'workload', 'delay', 'capacity'];
    const text = `${intent.category} ${intent.action} ${intent.entities.join(' ')}`.toLowerCase();
    return keywords.some((kw) => text.includes(kw));
  }

  async execute(job: Job): Promise<AgentResult> {
    this.log.info('Scanning for bottlenecks', { jobId: job.id });

    const knowledgeContext = this.buildKnowledgeContext(job);
    const prompt = `אתה מומחה לניתוח תפעולי וזיהוי צווארי בקבוק.

## משימה
${job.input}

## ידע רלוונטי
${knowledgeContext}

## הנחיות
1. נתח את העומסים הנוכחיים
2. זהה צווארי בקבוק פוטנציאליים
3. חזה עיכובים אפשריים
4. הצע פתרונות מעשיים

## פורמט תשובה
- מצב נוכחי (סיכום)
- צווארי בקבוק שזוהו
  - תיאור הבעיה
  - חומרה (גבוהה/בינונית/נמוכה)
  - השפעה צפויה
- עיכובים צפויים
- פתרונות מומלצים
  - לטווח קצר
  - לטווח ארוך
- עדיפות לטיפול

כתוב בעברית, בצורה ברורה ומעשית.`;

    try {
      const response = await this.callLLM(prompt, 'reasoning');
      const citations = this.extractCitations(job);

      return this.success(response, {
        citations,
        confidence: job.knowledgePack.ready ? 'high' : 'medium',
        structured: {
          type: 'bottleneck_analysis',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.log.error('Failed to scan for bottlenecks', error as Error);
      return this.failure('שגיאה באיתור צווארי בקבוק');
    }
  }
}
