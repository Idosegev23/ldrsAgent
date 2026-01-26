/**
 * SEO to GEO Generator Agent
 * Agent #27 from the Multi-Agent System table
 * 
 * Uses GROUNDING to:
 * 1. Search Google for current "People Also Ask" and SGE results
 * 2. Rewrite article to directly answer these queries
 * 3. Use conversational, authoritative format optimized for AI answers
 * 
 * Input: Drive Existing Article/Content
 * Output: Rewritten content optimized for AI search engines
 */

import { BaseAgent } from '../../base-agent.js';
import type { Job, AgentResult } from '../../../types/job.types.js';
import type { Intent, AgentLayer } from '../../../types/agent.types.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class SeoGeoGeneratorAgent extends BaseAgent {
  id = 'media/seo-geo';
  name = 'SEO to GEO Generator Agent';
  nameHebrew = 'סוכן SEO TO GEO';
  layer: AgentLayer = 2;
  domain = 'media';
  capabilities = [
    'generate_seo_content',
    'optimize_for_geo',
    'keyword_research',
    'local_optimization',
  ];
  description = 'מייצר תוכן ממוטב ל-SEO ו-GEO';
  requiresKnowledge = true;
  
  // Agent #27 - Uses GROUNDING (Google Search)
  protected geminiTools: GeminiTool[] = ['grounding'];

  canHandle(intent: Intent): boolean {
    const keywords = ['seo', 'geo', 'אופטימיזציה', 'מילות מפתח', 'optimization', 'keywords', 'local'];
    const text = `${intent.category} ${intent.action} ${intent.entities.join(' ')}`.toLowerCase();
    return keywords.some((kw) => text.includes(kw));
  }

  async execute(job: Job): Promise<AgentResult> {
    this.log.info('Generating SEO/GEO content with Grounding', { jobId: job.id });

    try {
      const knowledgeContext = this.buildKnowledgeContext(job);
      
      // Extract topic from input
      const topic = this.extractTopic(job.rawInput);
      
      // Step 1: Use Grounding to find "People Also Ask" and current search trends
      this.log.info('Searching for current PAA and SGE patterns', { topic });
      const searchResult = await this.searchWeb(`${topic} "people also ask" שאלות נפוצות`);
      
      // Step 2: Search for SGE/AI overview patterns
      const sgeResult = await this.searchWeb(`${topic} AI overview search generative experience`);
      
      // Step 3: Generate optimized content
      const prompt = `אתה מומחה SEO ו-GEO (Generative Engine Optimization).

## משימה
${job.rawInput}

## תוכן קיים
${knowledgeContext}

## מידע עדכני מחיפוש (Grounding):
### שאלות נפוצות (People Also Ask):
${searchResult.text}

### מגמות SGE/AI:
${sgeResult.text}

## הנחיות GEO:
1. כתוב תשובות ישירות לשאלות ה-PAA שמצאת
2. השתמש בפורמט שיחתי וסמכותי
3. מבנה: שאלה → תשובה ישירה → הרחבה
4. אופטימיזציה ל-AI Overviews

## פורמט פלט:
- מילות מפתח (מתוך החיפוש)
- כותרת ממוטבת לשאלות
- תוכן בפורמט Q&A
- Schema markup recommendations
- המלצות GEO נוספות

כתוב בעברית, מותאם למנועי AI.`;

      const response = await this.callLLM(prompt, 'writing');
      
      // Add sources from grounding
      let output = response;
      if (searchResult.groundingMetadata?.sources) {
        output += '\n\n---\n## מקורות שנבדקו:\n';
        for (const source of searchResult.groundingMetadata.sources.slice(0, 5)) {
          output += `- [${source.title}](${source.uri})\n`;
        }
      }

      return this.success(output, {
        citations: this.extractCitations(job),
        confidence: 'high',
        structured: {
          type: 'seo_geo_content',
          topic,
          groundingSources: searchResult.groundingMetadata?.sources || [],
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.log.error('Failed to generate SEO/GEO content', error as Error);
      return this.failure('שגיאה ביצירת תוכן SEO/GEO');
    }
  }
  
  private extractTopic(input: string): string {
    // Extract main topic from input
    const topicPatterns = [
      /(?:על|בנושא|לגבי|topic)\s+["']?([^"'\n]+)["']?/i,
      /(?:תוכן|מאמר|article)\s+["']?([^"'\n]+)["']?/i,
    ];
    
    for (const pattern of topicPatterns) {
      const match = input.match(pattern);
      if (match) return match[1].trim();
    }
    
    // Fallback: first meaningful phrase
    return input.slice(0, 50).trim();
  }
}
