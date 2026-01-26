/**
 * Annual Strategy Quote Generator Agent
 * Agent #11 from the Multi-Agent System table
 * 
 * Uses LONG CONTEXT to:
 * 1. Build proposals as part of annual plan with logic and milestones
 * 2. Create sense of partnership and broad vision
 * 3. Retain customers and increase lifetime value
 * 
 * Input: Brand research, annual budget, strategic goals
 * Output: Comprehensive annual strategy with quarterly breakdown
 */

import { BaseAgent } from '../../base-agent.js';
import { researchBrand } from '../../../knowledge/brand-research.js';
import { researchInfluencers } from '../../../knowledge/influencer-research.js';
import { generateProposalContent } from './content-writer.js';
import type { Job, AgentResult, Intent } from '../../../types/index.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class AnnualQuoteAgent extends BaseAgent {
  id = 'proposals/annual-quote';
  name = 'Annual Strategy Quote Generator';
  nameHebrew = 'מחולל הצעות שנתיות';
  layer = 2 as const;
  domain = 'proposals';
  description = 'יוצר הצעות מחיר לאסטרטגיה שנתית מקיפה';
  capabilities = [
    'annual-strategy',
    'brand-research',
    'influencer-strategy',
    'proposal-writing',
    'quarterly-planning',
  ];
  
  // Agent #11 - Uses LONG CONTEXT
  protected geminiTools: GeminiTool[] = [];

  canHandle(intent: Intent): boolean {
    if (intent.primary === 'annual_strategy') return true;
    if (intent.primary === 'generate_proposal' && 
        intent.entities.timeframe?.includes('שנ')) return true;
    return false;
  }

  async execute(job: Job): Promise<AgentResult> {
    const jobLog = this.log.child({ jobId: job.id });
    jobLog.info('Starting annual strategy quote generation');

    try {
      const params = this.extractParameters(job.rawInput);
      
      if (!params.brandName) {
        return this.failure('לא צוין שם מותג להצעה השנתית');
      }

      // Research brand
      jobLog.info('Researching brand', { brand: params.brandName });
      const brandResearch = await researchBrand(params.brandName);

      // Research influencers with annual budget
      const annualBudget = params.budget || 500000;
      const influencerStrategy = await researchInfluencers(
        brandResearch,
        annualBudget,
        params.goals || ['מודעות', 'מעורבות', 'המרות']
      );

      // Generate quarterly breakdown
      const quarterlyPlan = this.generateQuarterlyPlan(
        brandResearch,
        annualBudget,
        params.goals || []
      );

      // Generate proposal
      const proposalContent = await generateProposalContent({
        brandResearch,
        budget: annualBudget,
        goals: params.goals,
      });

      // Format annual output
      const output = this.formatAnnualOutput(
        proposalContent,
        influencerStrategy,
        quarterlyPlan,
        params
      );

      return this.success(output, {
        structured: {
          brandResearch,
          influencerStrategy,
          proposalContent,
          quarterlyPlan,
        },
        citations: this.mapSourcesToCitations(brandResearch.sources || []),
        confidence: proposalContent.confidence,
      });
    } catch (error) {
      jobLog.error('Annual quote generation failed', error as Error);
      return this.failure('אירעה שגיאה ביצירת ההצעה השנתית');
    }
  }

  private extractParameters(input: string): {
    brandName?: string;
    budget?: number;
    goals?: string[];
  } {
    const budgetMatch = input.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:ש[״"]?ח|₪|שקל)/);
    const budget = budgetMatch 
      ? parseInt(budgetMatch[1].replace(/,/g, '')) 
      : undefined;

    const brandPatterns = [
      /(?:מותג|לקוח|עבור|ל)\s+["']?([א-תA-Za-z0-9\s]+)["']?/,
    ];

    let brandName: string | undefined;
    for (const pattern of brandPatterns) {
      const match = input.match(pattern);
      if (match) {
        brandName = match[1].trim();
        break;
      }
    }

    const goals: string[] = [];
    if (input.includes('מודעות')) goals.push('מודעות');
    if (input.includes('חשיפה')) goals.push('חשיפה');
    if (input.includes('מכירות')) goals.push('מכירות');
    if (input.includes('מעורבות')) goals.push('מעורבות');
    if (input.includes('לידים')) goals.push('לידים');
    if (input.includes('נאמנות')) goals.push('נאמנות');

    return { brandName, budget, goals: goals.length > 0 ? goals : undefined };
  }

  private mapSourcesToCitations(sources: { title: string; url: string }[]): { source: string; content: string; documentId: string }[] {
    return sources.map((s, i) => ({
      source: s.url,
      content: s.title,
      documentId: `source-${i}`,
    }));
  }

  private generateQuarterlyPlan(
    _brand: any,
    annualBudget: number,
    _goals: string[]
  ): QuarterlyPlan {
    const quarterBudget = Math.round(annualBudget / 4);

    return {
      q1: {
        name: 'רבעון 1 - השקה ובסיס',
        budget: quarterBudget,
        focus: 'בניית מודעות ותשתית',
        activities: [
          'מחקר מעמיק ובחירת משפיענים',
          'קמפיין השקה',
          'תוכן בסיסי',
        ],
        kpis: ['reach', 'followers'],
        influencerCount: 4,
      },
      q2: {
        name: 'רבעון 2 - צמיחה',
        budget: quarterBudget,
        focus: 'הגדלת מעורבות',
        activities: [
          'קמפיין אביב/קיץ',
          'שיתופי פעולה מורחבים',
          'תוכן וידאו',
        ],
        kpis: ['engagement', 'saves'],
        influencerCount: 6,
      },
      q3: {
        name: 'רבעון 3 - התבססות',
        budget: quarterBudget,
        focus: 'המרות ומכירות',
        activities: [
          'קמפיין המרות',
          'תוכן ממוקד מוצר',
          'אקטיבציות',
        ],
        kpis: ['conversions', 'sales'],
        influencerCount: 8,
      },
      q4: {
        name: 'רבעון 4 - שיא ונאמנות',
        budget: quarterBudget,
        focus: 'חגים ונאמנות',
        activities: [
          'קמפיין חגים',
          'רימרקטינג',
          'בניית קהילה',
        ],
        kpis: ['retention', 'loyalty'],
        influencerCount: 10,
      },
    };
  }

  private formatAnnualOutput(
    proposal: any,
    _influencers: any,
    quarterlyPlan: QuarterlyPlan,
    params: any
  ): string {
    const totalBudget = params.budget || 500000;
    
    const lines: string[] = [
      `# 📅 אסטרטגיה שנתית: ${proposal.campaignName}`,
      `*${proposal.campaignSubtitle}*`,
      '',
      '---',
      '',
      '## סקירה כללית',
      proposal.brandDescription,
      '',
      '## מטרות שנתיות',
      ...proposal.goals.map((g: any) => `- **${g.title}**: ${g.description}`),
      '',
      '## אסטרטגיה',
      proposal.strategyHeadline,
      '',
      ...proposal.strategyPillars?.map((p: any) => `### ${p.title}\n${p.description}`) || [],
      '',
      '---',
      '',
      '# 📊 תוכנית רבעונית',
      '',
    ];

    // Add quarterly details
    for (const [_key, quarter] of Object.entries(quarterlyPlan)) {
      lines.push(`## ${quarter.name}`);
      lines.push(`**תקציב:** ${quarter.budget.toLocaleString()} ₪`);
      lines.push(`**מיקוד:** ${quarter.focus}`);
      lines.push('');
      lines.push('### פעילויות:');
      lines.push(...quarter.activities.map((a: string) => `- ${a}`));
      lines.push('');
      lines.push(`**מדדי הצלחה:** ${quarter.kpis.join(', ')}`);
      lines.push(`**משפיענים:** ${quarter.influencerCount}`);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('# 💰 סיכום תקציבי');
    lines.push('');
    lines.push(`| רבעון | תקציב | משפיענים |`);
    lines.push(`|--------|--------|----------|`);
    lines.push(`| Q1 | ${quarterlyPlan.q1.budget.toLocaleString()} ₪ | ${quarterlyPlan.q1.influencerCount} |`);
    lines.push(`| Q2 | ${quarterlyPlan.q2.budget.toLocaleString()} ₪ | ${quarterlyPlan.q2.influencerCount} |`);
    lines.push(`| Q3 | ${quarterlyPlan.q3.budget.toLocaleString()} ₪ | ${quarterlyPlan.q3.influencerCount} |`);
    lines.push(`| Q4 | ${quarterlyPlan.q4.budget.toLocaleString()} ₪ | ${quarterlyPlan.q4.influencerCount} |`);
    lines.push(`| **סה"כ** | **${totalBudget.toLocaleString()} ₪** | **${quarterlyPlan.q1.influencerCount + quarterlyPlan.q2.influencerCount + quarterlyPlan.q3.influencerCount + quarterlyPlan.q4.influencerCount}** |`);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## מדדים צפויים שנתיים');
    lines.push(`- **חשיפה כוללת:** ${(proposal.metrics.potentialReach * 4).toLocaleString()}`);
    lines.push(`- **מעורבות כוללת:** ${(proposal.metrics.potentialEngagement * 4).toLocaleString()}`);
    lines.push(`- **CPE ממוצע:** ${proposal.metrics.cpe} ₪`);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(proposal.closingStatement);
    lines.push('');
    lines.push('**השלבים הבאים:**');
    lines.push(...proposal.nextSteps.map((s: string) => `1. ${s}`));

    return lines.join('\n');
  }
}

interface QuarterData {
  name: string;
  budget: number;
  focus: string;
  activities: string[];
  kpis: string[];
  influencerCount: number;
}

interface QuarterlyPlan {
  q1: QuarterData;
  q2: QuarterData;
  q3: QuarterData;
  q4: QuarterData;
}
