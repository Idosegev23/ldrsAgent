/**
 * Classic Quote Generator Agent
 * Agent #1, #10, #11 from the Multi-Agent System table
 * 
 * Uses LONG CONTEXT to:
 * 1. Ingest Brand Book, Case Studies, Pricing List from Drive
 * 2. Merge client brief with brand tone of voice
 * 3. Select relevant Case Studies based on client industry
 * 4. Generate full proposal (Introduction, Problem, Solution, Pricing)
 * 
 * Input: ClickUp Client Brief, Task Description, Drive Brand Documents
 * Output: Complete proposal text sections
 */

import { BaseAgent } from '../../base-agent.js';
import { researchBrand } from '../../../knowledge/brand-research.js';
import { researchInfluencers } from '../../../knowledge/influencer-research.js';
import { generateProposalContent } from './content-writer.js';
import type { Job, AgentResult, Intent } from '../../../types/index.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class ClassicQuoteAgent extends BaseAgent {
  id = 'proposals/classic-quote';
  name = 'Classic Quote Generator';
  nameHebrew = 'מחולל הצעות מחיר';
  layer = 2 as const;
  domain = 'proposals';
  description = 'יוצר הצעות מחיר מקצועיות מבריף קלאסי, כולל מחקר מותג ואסטרטגיית משפיענים';
  capabilities = [
    'generate-quote',
    'brand-research',
    'influencer-strategy',
    'proposal-writing',
  ];
  
  // Agent #1, #10, #11 - Uses LONG CONTEXT
  protected geminiTools: GeminiTool[] = [];

  canHandle(intent: Intent): boolean {
    if (intent.primary === 'generate_proposal') return true;
    if (intent.primary === 'create_quote') return true;
    return false;
  }

  async execute(job: Job): Promise<AgentResult> {
    const jobLog = this.log.child({ jobId: job.id });
    jobLog.info('Starting classic quote generation');

    try {
      // Extract parameters from job input
      const params = this.extractParameters(job.rawInput);
      
      if (!params.brandName) {
        return this.failure('לא צוין שם מותג. אנא ציין את שם המותג להצעת המחיר.');
      }

      // Step 1: Research the brand
      jobLog.info('Researching brand', { brand: params.brandName });
      const brandResearch = await researchBrand(params.brandName);

      // Step 2: Research influencers
      jobLog.info('Researching influencers');
      const influencerStrategy = await researchInfluencers(
        brandResearch,
        params.budget || 50000,
        params.goals || ['מודעות', 'חשיפה']
      );

      // Step 3: Generate proposal content
      jobLog.info('Generating proposal content');
      const proposalContent = await generateProposalContent({
        brandResearch,
        budget: params.budget || 50000,
        currency: params.currency || '₪',
        goals: params.goals,
      });

      // Format output
      const output = this.formatProposalOutput(
        proposalContent,
        influencerStrategy,
        params
      );

      return this.success(output, {
        structured: {
          brandResearch,
          influencerStrategy,
          proposalContent,
          params,
        },
        citations: this.mapSourcesToCitations(brandResearch.sources || []),
        confidence: proposalContent.confidence === 'high' ? 'high' : 'medium',
      });
    } catch (error) {
      jobLog.error('Quote generation failed', error as Error);
      return this.failure('אירעה שגיאה ביצירת הצעת המחיר. אנא נסה שוב.');
    }
  }

  private mapSourcesToCitations(sources: { title: string; url: string }[]): { source: string; content: string; documentId: string }[] {
    return sources.map((s, i) => ({
      source: s.url,
      content: s.title,
      documentId: `source-${i}`,
    }));
  }

  private extractParameters(input: string): {
    brandName?: string;
    budget?: number;
    goals?: string[];
    currency?: string;
  } {
    // Simple extraction - in production would use LLM
    const budgetMatch = input.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:ש[״"]?ח|₪|שקל)/);
    const budget = budgetMatch 
      ? parseInt(budgetMatch[1].replace(/,/g, '')) 
      : undefined;

    // Extract brand name - assume it's mentioned
    const brandPatterns = [
      /(?:מותג|לקוח|עבור|ל)\s+["']?([א-תA-Za-z0-9\s]+)["']?/,
      /^([א-תA-Za-z0-9\s]+)\s*[-–]/,
    ];

    let brandName: string | undefined;
    for (const pattern of brandPatterns) {
      const match = input.match(pattern);
      if (match) {
        brandName = match[1].trim();
        break;
      }
    }

    // Extract goals
    const goals: string[] = [];
    if (input.includes('מודעות')) goals.push('מודעות');
    if (input.includes('חשיפה')) goals.push('חשיפה');
    if (input.includes('מכירות')) goals.push('מכירות');
    if (input.includes('מעורבות')) goals.push('מעורבות');
    if (input.includes('לידים')) goals.push('לידים');

    return {
      brandName,
      budget,
      goals: goals.length > 0 ? goals : undefined,
    };
  }

  private formatProposalOutput(
    proposal: any,
    influencers: any,
    _params: any
  ): string {
    const lines: string[] = [
      `# ${proposal.campaignName}`,
      `*${proposal.campaignSubtitle}*`,
      '',
      '## הבריף',
      proposal.brandBrief,
      '',
      '## המותג',
      proposal.brandDescription,
      '',
      '## מטרות הקמפיין',
      ...proposal.goals.map((g: any) => `- **${g.title}**: ${g.description}`),
      '',
      '## קהל יעד',
      `${proposal.targetAudience.primary.gender}, ${proposal.targetAudience.primary.ageRange}`,
      proposal.targetAudience.behavior,
      '',
      '## אסטרטגיה',
      proposal.strategyHeadline,
      '',
      '## תוצרים',
      ...proposal.deliverables.map((d: any) => `- ${d.quantity}x ${d.type}: ${d.description}`),
      '',
      '## תקציב ומדדים',
      `- תקציב: ${proposal.metrics.budget.toLocaleString()} ${proposal.metrics.currency}`,
      `- חשיפה צפויה: ${proposal.metrics.potentialReach.toLocaleString()}`,
      `- מעורבות צפויה: ${proposal.metrics.potentialEngagement.toLocaleString()}`,
      `- CPE: ${proposal.metrics.cpe} ${proposal.metrics.currency}`,
      '',
      '## המלצות משפיענים',
      influencers.strategySummary || 'אסטרטגיית משפיענים מותאמת למותג',
      '',
      '---',
      proposal.closingStatement,
    ];

    return lines.join('\n');
  }
}
