/**
 * Influencer Hub Agent
 * Agent #17 from the Multi-Agent System table
 * 
 * Uses VIDEO UNDERSTANDING to:
 * 1. Watch provided video content (Reels/TikToks)
 * 2. Analyze creator's communication style, energy level, audience sentiment
 * 3. Determine if they align with Brand's values ("Family Safe" or "Edgy")
 * 
 * Input: Drive/Social Video Links (Reels/TikToks)
 * Output: Influencer analysis with brand fit assessment
 */

import { BaseAgent } from '../../base-agent.js';
import { researchBrand } from '../../../knowledge/brand-research.js';
import { researchInfluencers, getQuickInfluencerSuggestions } from '../../../knowledge/influencer-research.js';
import type { Job, AgentResult, Intent } from '../../../types/index.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class InfluencerResearchHubAgent extends BaseAgent {
  id = 'influencers/research-hub';
  name = 'Influencer Research Hub';
  nameHebrew = 'מרכז מחקר משפיענים';
  layer = 2 as const;
  domain = 'influencers';
  description = 'מבצע מחקר מעמיק על משפיענים בפלטפורמות שונות, בודק התאמת קהל ואיכות מעורבות';
  capabilities = [
    'influencer-research',
    'audience-matching',
    'engagement-analysis',
    'influencer-recommendations',
    'video-analysis',
  ];
  
  // Agent #17 - Uses VIDEO UNDERSTANDING
  protected geminiTools: GeminiTool[] = ['video'];

  canHandle(intent: Intent): boolean {
    if (intent.primary === 'influencer_research') return true;
    if (intent.primary === 'influencer_concept') return true;
    return false;
  }

  async execute(job: Job): Promise<AgentResult> {
    const jobLog = this.log.child({ jobId: job.id });
    jobLog.info('Starting influencer research');

    try {
      const params = this.extractParameters(job.rawInput);

      // If we have a brand name, do full research
      if (params.brandName) {
        jobLog.info('Full research with brand', { brand: params.brandName });
        
        // Research the brand first
        const brandResearch = await researchBrand(params.brandName);
        
        // Research influencers based on brand
        const influencerStrategy = await researchInfluencers(
          brandResearch,
          params.budget || 50000,
          params.goals || ['מודעות', 'מעורבות']
        );

        const output = this.formatFullResearch(brandResearch, influencerStrategy, params);

        return this.success(output, {
          structured: {
            brandResearch,
            influencerStrategy,
            params,
          },
          citations: this.mapSourcesToCitations(brandResearch.sources || []),
          confidence: brandResearch.confidence,
        });
      }

      // Quick research without brand
      jobLog.info('Quick influencer suggestions');
      
      const suggestions = await getQuickInfluencerSuggestions(
        params.industry || 'לייפסטייל',
        params.targetAudience || 'נשים 25-45',
        params.budget || 50000
      );

      const output = this.formatQuickSuggestions(suggestions, params);

      return this.success(output, {
        structured: { suggestions, params },
        confidence: 'medium',
      });
    } catch (error) {
      jobLog.error('Influencer research failed', error as Error);
      return this.failure('אירעה שגיאה במחקר משפיענים');
    }
  }

  private mapSourcesToCitations(sources: { title: string; url: string }[]): { source: string; content: string; documentId: string }[] {
    return sources.map((s, i) => ({
      source: s.url,
      content: s.title,
      documentId: `source-${i}`,
    }));
  }

  private extractParameters(input: string): ResearchParams {
    const params: ResearchParams = {};

    // Extract brand name
    const brandPatterns = [
      /(?:מותג|לקוח|עבור|ל)\s+["']?([א-תA-Za-z0-9\s]+)["']?/,
    ];
    for (const pattern of brandPatterns) {
      const match = input.match(pattern);
      if (match) {
        params.brandName = match[1].trim();
        break;
      }
    }

    // Extract budget
    const budgetMatch = input.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:ש[״"]?ח|₪|שקל)/);
    if (budgetMatch) {
      params.budget = parseInt(budgetMatch[1].replace(/,/g, ''));
    }

    // Extract platform preferences
    const platforms: string[] = [];
    if (input.includes('אינסטגרם') || input.includes('instagram')) platforms.push('instagram');
    if (input.includes('טיקטוק') || input.includes('tiktok')) platforms.push('tiktok');
    if (input.includes('יוטיוב') || input.includes('youtube')) platforms.push('youtube');
    if (platforms.length > 0) params.platforms = platforms;

    // Extract industry
    const industries = ['אופנה', 'קוסמטיקה', 'מזון', 'טכנולוגיה', 'לייפסטייל', 'ספורט', 'בריאות'];
    for (const ind of industries) {
      if (input.includes(ind)) {
        params.industry = ind;
        break;
      }
    }

    // Extract influencer count
    const countMatch = input.match(/(\d+)\s*משפיענ/);
    if (countMatch) {
      params.influencerCount = parseInt(countMatch[1]);
    }

    // Extract goals
    const goals: string[] = [];
    if (input.includes('מודעות')) goals.push('מודעות');
    if (input.includes('מעורבות')) goals.push('מעורבות');
    if (input.includes('מכירות')) goals.push('מכירות');
    if (input.includes('חשיפה')) goals.push('חשיפה');
    if (goals.length > 0) params.goals = goals;

    return params;
  }

  private formatFullResearch(brand: any, strategy: any, _params: ResearchParams): string {
    const lines: string[] = [
      `# 🎯 מחקר משפיענים: ${brand.brandName}`,
      '',
      '---',
      '',
      '## סיכום אסטרטגי',
      strategy.strategySummary,
      '',
      '## שכבות משפיענים מומלצות',
      '',
    ];

    for (const tier of strategy.tiers || []) {
      lines.push(`### ${tier.name}`);
      lines.push(tier.description);
      lines.push(`- **כמות מומלצת:** ${tier.recommendedCount}`);
      lines.push(`- **הקצאת תקציב:** ${tier.budgetAllocation}`);
      lines.push(`- **מטרה:** ${tier.purpose}`);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('## 👤 המלצות משפיענים');
    lines.push('');

    if (strategy.recommendations && strategy.recommendations.length > 0) {
      for (const inf of strategy.recommendations) {
        lines.push(`### ${inf.name}`);
        lines.push(`**@${inf.handle}** | ${inf.platform} | ${inf.category}`);
        lines.push(`- **עוקבים:** ${inf.followers}`);
        lines.push(`- **מעורבות:** ${inf.engagement}`);
        lines.push(`- **למה מתאים:** ${inf.whyRelevant}`);
        lines.push(`- **סגנון תוכן:** ${inf.contentStyle}`);
        lines.push(`- **עלות משוערת:** ${inf.estimatedCost}`);
        lines.push('');
      }
    } else {
      lines.push('*יש לבצע מחקר מעמיק יותר להמלצות ספציפיות*');
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('## 🎨 נושאי תוכן מומלצים');
    lines.push('');

    if (strategy.contentThemes && strategy.contentThemes.length > 0) {
      for (const theme of strategy.contentThemes) {
        lines.push(`### ${theme.theme}`);
        lines.push(theme.description);
        lines.push('**דוגמאות:**');
        lines.push(...theme.examples.map((e: string) => `- ${e}`));
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
    lines.push('## 📊 KPIs צפויים');
    lines.push('');

    if (strategy.expectedKPIs && strategy.expectedKPIs.length > 0) {
      lines.push('| מדד | יעד | הסבר |');
      lines.push('|-----|-----|------|');
      for (const kpi of strategy.expectedKPIs) {
        lines.push(`| ${kpi.metric} | ${kpi.target} | ${kpi.rationale} |`);
      }
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## ⏱️ לוח זמנים מוצע');
    lines.push('');

    if (strategy.suggestedTimeline && strategy.suggestedTimeline.length > 0) {
      for (const phase of strategy.suggestedTimeline) {
        lines.push(`### ${phase.phase} (${phase.duration})`);
        lines.push(...phase.activities.map((a: string) => `- ${a}`));
        lines.push('');
      }
    }

    if (strategy.potentialRisks && strategy.potentialRisks.length > 0) {
      lines.push('---');
      lines.push('');
      lines.push('## ⚠️ סיכונים ומיטיגציה');
      lines.push('');
      for (const risk of strategy.potentialRisks) {
        lines.push(`- **${risk.risk}:** ${risk.mitigation}`);
      }
    }

    return lines.join('\n');
  }

  private formatQuickSuggestions(suggestions: any[], params: ResearchParams): string {
    const lines: string[] = [
      '# 🎯 המלצות משפיענים מהירות',
      '',
      `**תעשייה:** ${params.industry || 'כללי'}`,
      `**תקציב:** ${params.budget?.toLocaleString() || '50,000'} ₪`,
      '',
      '---',
      '',
    ];

    if (suggestions.length > 0) {
      for (const inf of suggestions) {
        lines.push(`## ${inf.name}`);
        lines.push(`**@${inf.handle}** | ${inf.platform}`);
        lines.push('');
        lines.push(`- **קטגוריה:** ${inf.category}`);
        lines.push(`- **עוקבים:** ${inf.followers}`);
        lines.push(`- **מעורבות:** ${inf.engagement}`);
        lines.push(`- **למה מתאים:** ${inf.whyRelevant}`);
        lines.push(`- **עלות משוערת:** ${inf.estimatedCost}`);
        lines.push('');
      }
    } else {
      lines.push('*לא נמצאו המלצות. נסה לציין מותג ספציפי למחקר מעמיק יותר.*');
    }

    lines.push('---');
    lines.push('');
    lines.push('*לתוצאות מדויקות יותר, ציין שם מותג ספציפי*');

    return lines.join('\n');
  }
}

interface ResearchParams {
  brandName?: string;
  budget?: number;
  platforms?: string[];
  industry?: string;
  targetAudience?: string;
  influencerCount?: number;
  goals?: string[];
}
