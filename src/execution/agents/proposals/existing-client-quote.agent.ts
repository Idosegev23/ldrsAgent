/**
 * Existing Client Quote Generator Agent
 * Generates proposal for an existing client with historical data
 */

import { BaseAgent } from '../../base-agent.js';
import { generateProposalContent } from './content-writer.js';
import type { Job, AgentResult, Intent } from '../../../types/index.js';
import type { BrandResearch } from '../../../knowledge/brand-research.js';

export class ExistingClientQuoteAgent extends BaseAgent {
  id = 'proposals/existing-client-quote';
  name = 'Existing Client Quote Generator';
  nameHebrew = 'מחולל הצעות ללקוח קיים';
  layer = 2 as const;
  domain = 'proposals';
  description = 'יוצר הצעות מחיר ללקוחות קיימים תוך שימוש בהיסטוריית העבודה';
  capabilities = [
    'generate-quote',
    'client-history',
    'upsell-detection',
    'proposal-writing',
  ];

  canHandle(intent: Intent): boolean {
    if (intent.primary === 'generate_proposal' && intent.entities.clientName) {
      return true;
    }
    return false;
  }

  getConfidence(intent: Intent): number {
    // Higher confidence if we have client history in knowledge pack
    if (this.canHandle(intent)) {
      return 0.9; // Existing client = higher confidence
    }
    return 0;
  }

  async execute(job: Job): Promise<AgentResult> {
    const jobLog = this.log.child({ jobId: job.id });
    jobLog.info('Starting existing client quote generation');

    try {
      const clientName = job.intent.entities.clientName;
      
      if (!clientName) {
        return this.failure('לא צוין שם לקוח');
      }

      // Check knowledge pack for client history
      const clientKnowledge = this.extractClientHistory(job);
      
      if (!clientKnowledge.hasHistory) {
        jobLog.info('No client history found, delegating to classic quote');
        return this.needsSubTask(
          'לא נמצא מידע על הלקוח, מעביר להצעה קלאסית',
          'proposals/classic-quote',
          `צור הצעת מחיר עבור ${clientName}`,
          { brandName: clientName, rawInput: job.rawInput }
        );
      }

      // Build brand research from client history
      const brandResearch = this.buildBrandResearchFromHistory(clientName, clientKnowledge);

      // Detect upsell opportunities
      const upsellOpportunities = this.detectUpsellOpportunities(clientKnowledge);

      // Extract budget from input or use previous budget as reference
      const budget = this.extractBudget(job.rawInput) || clientKnowledge.lastBudget || 50000;

      // Generate proposal
      const proposalContent = await generateProposalContent({
        brandResearch,
        budget,
        goals: this.extractGoals(job.rawInput, clientKnowledge),
      });

      // Format output with client-specific context
      const output = this.formatOutput(proposalContent, clientKnowledge, upsellOpportunities);

      return this.success(output, {
        structured: {
          proposalContent,
          clientKnowledge,
          upsellOpportunities,
        },
        citations: this.extractCitations(job),
        confidence: 'high',
      });
    } catch (error) {
      jobLog.error('Quote generation failed', error as Error);
      return this.failure('אירעה שגיאה ביצירת ההצעה');
    }
  }

  private extractClientHistory(job: Job): ClientHistory {
    const history: ClientHistory = {
      hasHistory: false,
      previousCampaigns: [],
      lastBudget: undefined,
      preferredInfluencers: [],
      successfulThemes: [],
      notes: [],
    };

    // Search in knowledge pack for client data
    for (const chunk of job.knowledgePack.chunks) {
      const content = chunk.content.toLowerCase();
      
      if (content.includes('קמפיין') || content.includes('campaign')) {
        history.hasHistory = true;
        history.previousCampaigns.push({
          name: chunk.source || 'קמפיין קודם',
          summary: chunk.content.slice(0, 200),
        });
      }

      // Extract budget mentions
      const budgetMatch = chunk.content.match(/(\d{1,3}(?:,\d{3})*)\s*(?:ש[״"]?ח|₪)/);
      if (budgetMatch) {
        history.lastBudget = parseInt(budgetMatch[1].replace(/,/g, ''));
      }
    }

    // Also check documents
    for (const doc of job.knowledgePack.documents) {
      if (doc.title?.includes('brief') || doc.title?.includes('proposal')) {
        history.hasHistory = true;
      }
    }

    return history;
  }

  private buildBrandResearchFromHistory(
    clientName: string,
    history: ClientHistory
  ): BrandResearch {
    return {
      brandName: clientName,
      officialName: clientName,
      industry: 'לקוח קיים',
      founded: 'לא ידוע',
      headquarters: 'ישראל',
      website: '',
      companyDescription: `${clientName} הוא לקוח ותיק שלנו. עבדנו יחד על ${history.previousCampaigns.length} קמפיינים.`,
      historyHighlights: history.previousCampaigns.map(c => c.name),
      businessModel: 'לא ידוע',
      marketPosition: 'לקוח קיים',
      competitors: [],
      uniqueSellingPoints: history.successfulThemes,
      competitiveAdvantages: [],
      mainProducts: [],
      pricePositioning: 'mid-range',
      targetDemographics: {
        primaryAudience: {
          gender: 'לא ידוע',
          ageRange: 'לא ידוע',
          socioeconomic: 'לא ידוע',
          lifestyle: 'לא ידוע',
          interests: [],
          painPoints: [],
          aspirations: [],
        },
        behavior: 'לא ידוע',
        purchaseDrivers: [],
      },
      brandPersonality: [],
      brandValues: [],
      brandPromise: '',
      toneOfVoice: 'מקצועי',
      visualIdentity: {
        primaryColors: [],
        style: 'לא ידוע',
        moodKeywords: [],
      },
      socialPresence: {},
      previousCampaigns: history.previousCampaigns.map(c => ({
        name: c.name,
        description: c.summary,
      })),
      influencerTypes: history.preferredInfluencers,
      contentThemes: history.successfulThemes,
      suggestedApproach: 'המשך שיתוף פעולה מוצלח',
      recommendedGoals: ['המשך חשיפה', 'הרחבת קהל'],
      potentialChallenges: [],
      industryTrends: [],
      sources: [],
      confidence: 'medium',
    };
  }

  private detectUpsellOpportunities(history: ClientHistory): string[] {
    const opportunities: string[] = [];

    if (history.previousCampaigns.length > 0 && history.previousCampaigns.length < 3) {
      opportunities.push('הרחבה לקמפיין שנתי');
    }

    if (!history.preferredInfluencers.some(i => i.includes('טיקטוק'))) {
      opportunities.push('התרחבות לטיקטוק');
    }

    if (history.lastBudget && history.lastBudget < 100000) {
      opportunities.push('הגדלת תקציב לתוצאות טובות יותר');
    }

    opportunities.push('תוספת הפקה');
    opportunities.push('אסטרטגיית תוכן שוטפת');

    return opportunities;
  }

  private extractBudget(input: string): number | undefined {
    const match = input.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:ש[״"]?ח|₪|שקל)/);
    return match ? parseInt(match[1].replace(/,/g, '')) : undefined;
  }

  private extractGoals(input: string, _history: ClientHistory): string[] {
    const goals: string[] = [];
    
    if (input.includes('המשך')) goals.push('המשכיות');
    if (input.includes('הרחבה')) goals.push('הרחבת קהל');
    if (input.includes('מכירות')) goals.push('מכירות');
    if (input.includes('חשיפה')) goals.push('חשיפה');
    
    if (goals.length === 0) {
      goals.push('המשך חשיפה', 'שימור קהל');
    }

    return goals;
  }

  private formatOutput(
    proposal: any,
    history: ClientHistory,
    upsellOpportunities: string[]
  ): string {
    const lines: string[] = [
      `# ${proposal.campaignName}`,
      '',
      '## רקע - לקוח קיים',
      `עבדנו יחד על ${history.previousCampaigns.length} קמפיינים בעבר.`,
      '',
      '### קמפיינים קודמים:',
      ...history.previousCampaigns.map((c: { name: string }) => `- ${c.name}`),
      '',
      '---',
      '',
      '## ההצעה החדשה',
      proposal.brandDescription,
      '',
      '## מטרות',
      ...proposal.goals.map((g: any) => `- **${g.title}**: ${g.description}`),
      '',
      '## תוצרים מוצעים',
      ...proposal.deliverables.map((d: any) => `- ${d.quantity}x ${d.type}`),
      '',
      '## תקציב',
      `${proposal.metrics.budget.toLocaleString()} ${proposal.metrics.currency}`,
      '',
      '---',
      '',
      '## 💡 הזדמנויות להרחבה',
      ...upsellOpportunities.map(o => `- ${o}`),
      '',
      proposal.closingStatement,
    ];

    return lines.join('\n');
  }
}

interface ClientHistory {
  hasHistory: boolean;
  previousCampaigns: { name: string; summary: string }[];
  lastBudget?: number;
  preferredInfluencers: string[];
  successfulThemes: string[];
  notes: string[];
}
