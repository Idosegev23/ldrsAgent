/**
 * Competitor Media Intelligence Agent
 * Agent #3, #8 from the Multi-Agent System table
 * 
 * Uses GROUNDING + VISION to:
 * 1. Visit competitor URLs
 * 2. Analyze Pricing and Services pages
 * 3. Compare Value Proposition vs. Our Services
 * Output: Structured comparison matrix
 */

import { BaseAgent } from '../../base-agent.js';
import { scrapeWebsite } from '../../../integrations/apify/scraper.js';
import type { Job, AgentResult } from '../../../types/job.types.js';
import type { Intent, AgentLayer } from '../../../types/agent.types.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class CompetitorMediaIntelAgent extends BaseAgent {
  id = 'media/competitor-intel';
  name = 'Competitor Media Intelligence Agent';
  nameHebrew = 'סוכן מודיעין מדיה מתחרים';
  layer: AgentLayer = 2;
  domain = 'media';
  capabilities = [
    'analyze_competitor_media',
    'track_ad_spend',
    'identify_strategies',
    'benchmark_performance',
    'compare_pricing',
    'analyze_services',
  ];
  description = 'מנתח אסטרטגיות מדיה של מתחרים, משווה מחירים ושירותים';
  requiresKnowledge = true;
  
  // Agent #3, #8 - Uses GROUNDING (Search)
  protected geminiTools: GeminiTool[] = ['grounding'];

  canHandle(intent: Intent): boolean {
    const keywords = ['מתחרים', 'מדיה', 'ניתוח', 'competitor', 'media', 'analysis', 'benchmark', 'מחקר'];
    const text = `${intent.primary} ${intent.entities.clientName || ''}`.toLowerCase();
    return keywords.some((kw) => text.includes(kw));
  }

  async execute(job: Job): Promise<AgentResult> {
    this.log.info('Analyzing competitor media with Grounding', { jobId: job.id });

    // Extract competitor URLs from input or knowledge
    const competitorUrls = this.extractCompetitorUrls(job);
    const knowledgeContext = this.buildKnowledgeContext(job);

    // Scrape competitor websites if URLs provided
    const competitorData: CompetitorData[] = [];
    
    for (const url of competitorUrls.slice(0, 5)) { // Max 5 competitors
      try {
        this.log.info('Scraping competitor', { url });
        const scraped = await scrapeWebsite(url);
        competitorData.push({
          url,
          name: scraped.title || this.extractDomainName(url),
          description: scraped.description,
          services: this.extractServices(scraped),
          pricing: this.extractPricing(scraped),
          socialLinks: scraped.socialLinks,
        });
      } catch (error) {
        this.log.warn('Failed to scrape competitor', { url, error });
      }
    }

    // Build comprehensive analysis prompt with Grounding
    const prompt = `אתה מומחה למודיעין תחרותי ומדיה.

## משימה
${job.rawInput}

## ידע רלוונטי על הלקוח/מותג שלנו
${knowledgeContext}

## מידע שנאסף על מתחרים
${competitorData.length > 0 ? JSON.stringify(competitorData, null, 2) : 'לא נמצאו אתרי מתחרים - בצע חיפוש'}

## הנחיות (השתמש ב-Grounding/Search):
1. **ניתוח מתחרים:** חקור כל מתחר - מה הם מציעים, מה המחירים
2. **דפי תמחור:** חפש מידע על מחירי שירותים (אם לא נמצא באתר)
3. **Value Proposition:** מה הערך המוצע של כל מתחר vs. השירותים שלנו
4. **נוכחות דיגיטלית:** איפה הם פעילים (פייסבוק, אינסטגרם, לינקדאין)
5. **קמפיינים אחרונים:** מה עשו לאחרונה בפרסום

## פורמט הפלט - מטריצת השוואה:

### טבלת השוואה
| מתחר | שירותים | טווח מחירים | USP | חוזקות | חולשות |
|------|---------|-------------|-----|--------|--------|

### ניתוח מפורט לכל מתחר:
1. סקירה כללית
2. שירותים עיקריים
3. מיצוב מחיר
4. נוכחות דיגיטלית
5. קמפיינים אחרונים

### הזדמנויות לנו:
- היכן אנחנו יכולים לנצח?
- מה חסר למתחרים?

### איומים:
- מה המתחרים עושים טוב יותר?
- מגמות בשוק

כתוב בעברית, בצורה אנליטית ומקצועית.`;

    try {
      const response = await this.callLLM(prompt, 'reasoning');
      const citations = this.extractCitations(job);

      // Add competitor sources as citations
      for (const comp of competitorData) {
        citations.push({
          source: comp.url,
          content: comp.name,
          documentId: `competitor-${comp.name}`,
        });
      }

      return this.success(response, {
        citations,
        confidence: competitorData.length > 0 ? 'high' : 'medium',
        structured: {
          type: 'competitor_comparison_matrix',
          competitorsAnalyzed: competitorData.length,
          competitors: competitorData.map(c => ({ name: c.name, url: c.url })),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.log.error('Failed to analyze competitor media', error as Error);
      return this.failure('שגיאה בניתוח מדיה מתחרים');
    }
  }

  private extractCompetitorUrls(job: Job): string[] {
    const urls: string[] = [];
    
    // From raw input
    const urlPattern = /https?:\/\/[^\s]+|www\.[^\s]+/gi;
    const inputUrls = job.rawInput.match(urlPattern) || [];
    urls.push(...inputUrls);

    // From knowledge pack
    for (const chunk of job.knowledgePack.chunks) {
      const chunkUrls = chunk.content.match(urlPattern) || [];
      urls.push(...chunkUrls);
    }

    // Remove duplicates
    return [...new Set(urls)];
  }

  private extractDomainName(url: string): string {
    try {
      const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
      return domain.replace('www.', '').split('.')[0];
    } catch {
      return url;
    }
  }

  private extractServices(scraped: any): string[] {
    const services: string[] = [];
    const serviceKeywords = ['שירות', 'service', 'שיווק', 'marketing', 'פרסום', 'advertising', 'קמפיין', 'campaign'];
    
    for (const heading of [...scraped.headings.h1, ...scraped.headings.h2]) {
      if (serviceKeywords.some(kw => heading.toLowerCase().includes(kw))) {
        services.push(heading);
      }
    }
    
    return services.slice(0, 10);
  }

  private extractPricing(scraped: any): string {
    const pricingKeywords = ['מחיר', 'price', 'עלות', 'cost', 'תעריף', 'חבילה', 'package', '₪', 'ש"ח'];
    
    for (const para of scraped.paragraphs) {
      if (pricingKeywords.some(kw => para.toLowerCase().includes(kw))) {
        return para.slice(0, 200);
      }
    }
    
    return 'לא נמצא מידע תמחור';
  }
}

interface CompetitorData {
  url: string;
  name: string;
  description: string;
  services: string[];
  pricing: string;
  socialLinks: Record<string, string>;
}
