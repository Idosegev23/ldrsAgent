/**
 * Proposal Content Writer
 * Generates high-quality proposal content using GPT
 * Adapted from pptmaker
 */

import { getLLMManager } from '../../../llm/manager.js';
import { logger } from '../../../utils/logger.js';
import type { BrandResearch } from '../../../knowledge/brand-research.js';

const log = logger.child({ component: 'ProposalWriter' });

export interface ProposalContent {
  // Cover
  campaignName: string;
  campaignSubtitle: string;

  // Brief
  brandBrief: string;
  brandPainPoints: string[];
  brandObjective: string;

  // Goals
  goals: {
    title: string;
    description: string;
  }[];

  // Target Audience
  targetAudience: {
    primary: {
      gender: string;
      ageRange: string;
      description: string;
    };
    secondary?: {
      gender: string;
      ageRange: string;
      description: string;
    };
    behavior: string;
    insights: string[];
  };

  // Insight & Strategy
  keyInsight: string;
  insightSource: string;
  strategyHeadline: string;
  strategyPillars: {
    title: string;
    description: string;
  }[];

  // Brand
  brandDescription: string;
  brandHighlights: string[];
  brandOpportunity: string;

  // Activity
  activityTitle: string;
  activityConcept: string;
  activityDescription: string;
  activityApproach: {
    title: string;
    description: string;
  }[];
  activityDifferentiator: string;

  // Deliverables
  deliverables: {
    type: string;
    quantity: number;
    description: string;
    purpose: string;
  }[];
  deliverablesSummary: string;

  // Metrics
  metrics: {
    budget: number;
    currency: string;
    potentialReach: number;
    potentialEngagement: number;
    cpe: number;
    cpm?: number;
    estimatedImpressions?: number;
  };
  metricsExplanation: string;

  // Influencers
  influencerStrategy: string;
  influencerCriteria: string[];
  contentGuidelines: string[];

  // Closing
  closingStatement: string;
  nextSteps: string[];

  // Metadata
  toneUsed: string;
  confidence: 'high' | 'medium' | 'low';
}

const PROPOSAL_SYSTEM_PROMPT = `אתה מנהל אסטרטגיה בכיר בסוכנות שיווק משפיענים מובילה. תפקידך לכתוב הצעות מחיר מקצועיות ומשכנעות.

## עקרונות הכתיבה שלך:
1. **עומק ותוכן** - כל פסקה צריכה להיות משמעותית ומלאה במידע
2. **טון מותאם** - התאם את הטון לאופי המותג
3. **ללא סופרלטיבים ריקים** - אל תכתוב "הכי טוב" או "מוביל" ללא ביסוס
4. **ספציפיות** - מספרים, עובדות, תובנות קונקרטיות
5. **זרימה נרטיבית** - ההצעה צריכה לספר סיפור הגיוני
6. **ביטחון שקט** - מוכר בביטחון, לא בלחץ

## כלל זהב:
הלקוח צריך לקרוא את ההצעה ולהגיד "וואו, הם באמת מבינים אותי".`;

export interface GenerateProposalOptions {
  brandResearch: BrandResearch;
  budget: number;
  currency?: string;
  goals?: string[];
}

/**
 * Generate comprehensive proposal content
 */
export async function generateProposalContent(
  options: GenerateProposalOptions
): Promise<ProposalContent> {
  log.info('Generating proposal content', {
    brand: options.brandResearch.brandName,
    budget: options.budget,
  });

  const llm = getLLMManager();

  const prompt = `${PROPOSAL_SYSTEM_PROMPT}

## מחקר מותג:
- שם: ${options.brandResearch.brandName}
- תעשייה: ${options.brandResearch.industry}
- תיאור: ${options.brandResearch.companyDescription}
- קהל יעד: ${JSON.stringify(options.brandResearch.targetDemographics?.primaryAudience || {})}
- ערכים: ${options.brandResearch.brandValues?.join(', ') || 'לא ידוע'}
- USPs: ${options.brandResearch.uniqueSellingPoints?.join(', ') || 'לא ידוע'}
- מתחרים: ${options.brandResearch.competitors?.map(c => c.name).join(', ') || 'לא ידוע'}

## קלט:
- תקציב: ${options.budget.toLocaleString()} ${options.currency || '₪'}
- מטרות: ${options.goals?.join(', ') || 'מודעות, חשיפה'}

כתוב תוכן מלא להצעת מחיר. חובה 3+ פסקאות לתיאור המותג.`;

  try {
    const content = await llm.generateStructured<ProposalContent>(
      prompt,
      getProposalSchema(),
      'writing'
    );

    log.info('Proposal content generated', {
      brand: options.brandResearch.brandName,
      confidence: content.confidence,
    });

    return content;
  } catch (error) {
    log.error('Proposal generation failed', error as Error);
    return getDefaultContent(options);
  }
}

/**
 * Generate just brand description
 */
export async function generateBrandDescription(
  brandResearch: BrandResearch
): Promise<string> {
  const llm = getLLMManager();

  const prompt = `כתוב תיאור מקצועי ועשיר על המותג "${brandResearch.brandName}".

מידע:
- תעשייה: ${brandResearch.industry}
- תיאור קיים: ${brandResearch.companyDescription}
- ערכים: ${brandResearch.brandValues?.join(', ')}
- USPs: ${brandResearch.uniqueSellingPoints?.join(', ')}

כתוב 3-5 פסקאות מלאות. טון: ${brandResearch.toneOfVoice || 'מקצועי'}.`;

  try {
    return await llm.generateText(prompt, 'writing');
  } catch (error) {
    log.error('Brand description generation failed', error as Error);
    return brandResearch.companyDescription || `${brandResearch.brandName} הוא מותג ${brandResearch.industry}.`;
  }
}

/**
 * Generate activity description
 */
export async function generateActivityDescription(
  brandResearch: BrandResearch,
  goals: string[]
): Promise<{
  title: string;
  concept: string;
  description: string;
  approaches: { title: string; description: string }[];
}> {
  const llm = getLLMManager();

  const prompt = `כתוב תיאור פעילות משפיענים עבור "${brandResearch.brandName}".
מטרות: ${goals.join(', ')}
קהל יעד: ${brandResearch.targetDemographics?.primaryAudience?.lifestyle || 'כללי'}
טון: ${brandResearch.toneOfVoice || 'מקצועי'}`;

  try {
    return await llm.generateStructured<{
      title: string;
      concept: string;
      description: string;
      approaches: { title: string; description: string }[];
    }>(
      prompt,
      {
        type: 'object',
        properties: {
          title: { type: 'string' },
          concept: { type: 'string' },
          description: { type: 'string' },
          approaches: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
              },
            },
          },
        },
        required: ['title', 'concept', 'description', 'approaches'],
      },
      'writing'
    );
  } catch (error) {
    log.error('Activity description generation failed', error as Error);
    return {
      title: 'פעילות משפיענים',
      concept: 'שיתוף פעולה עם משפיענים להגברת המודעות',
      description: 'משפיענים יציגו את המותג באופן אותנטי',
      approaches: [
        { title: 'תוכן אותנטי', description: 'הצגה בשגרה אמיתית' },
        { title: 'סיפור אישי', description: 'שיתוף חוויה אישית' },
      ],
    };
  }
}

function getDefaultContent(options: GenerateProposalOptions): ProposalContent {
  const cpe = 2.5;
  const engagement = Math.round(options.budget / cpe);
  const reach = engagement * 3;

  return {
    campaignName: `קמפיין ${options.brandResearch.brandName}`,
    campaignSubtitle: 'שיתוף פעולה עם משפיענים',

    brandBrief: `${options.brandResearch.brandName} מחפש להגדיל את המודעות למותג`,
    brandPainPoints: ['חשיפה מוגבלת', 'קושי להגיע לקהל חדש'],
    brandObjective: 'הגדלת מודעות ומעורבות',

    goals: (options.goals || ['מודעות', 'חשיפה']).map((g) => ({
      title: g,
      description: `השגת ${g} באמצעות תוכן אותנטי`,
    })),

    targetAudience: {
      primary: {
        gender: options.brandResearch.targetDemographics?.primaryAudience?.gender || 'נשים וגברים',
        ageRange: options.brandResearch.targetDemographics?.primaryAudience?.ageRange || '25-45',
        description: 'קהל יעד מגוון',
      },
      behavior: options.brandResearch.targetDemographics?.behavior || 'פעילים ברשתות',
      insights: ['מושפעים מתוכן אותנטי'],
    },

    keyInsight: 'הקהל מחפש המלצות אמיתיות',
    insightSource: 'ניתוח שוק',
    strategyHeadline: 'בניית אמון דרך תוכן אותנטי',
    strategyPillars: [
      { title: 'אותנטיות', description: 'תוכן כן ואמיתי' },
      { title: 'רלוונטיות', description: 'משפיענים שמתאימים לקהל' },
    ],

    brandDescription: options.brandResearch.companyDescription || `${options.brandResearch.brandName} הוא מותג ${options.brandResearch.industry}.`,
    brandHighlights: options.brandResearch.uniqueSellingPoints || [],
    brandOpportunity: 'הזדמנות להגיע לקהלים חדשים',

    activityTitle: 'פעילות משפיענים',
    activityConcept: 'שיתוף פעולה להגברת מודעות',
    activityDescription: 'משפיענים יציגו את המותג באופן אותנטי',
    activityApproach: [
      { title: 'תוכן אותנטי', description: 'הצגה בשגרה אמיתית' },
    ],
    activityDifferentiator: 'דגש על אותנטיות',

    deliverables: [
      { type: 'רילים', quantity: 4, description: 'וידאו קצר', purpose: 'חשיפה' },
      { type: 'סטוריז', quantity: 12, description: 'תוכן אותנטי', purpose: 'מעורבות' },
    ],
    deliverablesSummary: 'חבילה מאוזנת',

    metrics: {
      budget: options.budget,
      currency: options.currency || '₪',
      potentialReach: reach,
      potentialEngagement: engagement,
      cpe,
      cpm: 15,
    },
    metricsExplanation: 'מבוסס על ממוצעים בתעשייה',

    influencerStrategy: 'בחירת משפיענים רלוונטיים',
    influencerCriteria: ['התאמה לקהל', 'איכות תוכן'],
    contentGuidelines: ['תוכן טבעי', 'שיתוף חוויה'],

    closingStatement: "LET'S GET STARTED",
    nextSteps: ['אישור הצעה', 'בחירת משפיענים', 'תחילת עבודה'],

    toneUsed: options.brandResearch.toneOfVoice || 'מקצועי',
    confidence: 'low',
  };
}

function getProposalSchema(): object {
  return {
    type: 'object',
    properties: {
      campaignName: { type: 'string' },
      campaignSubtitle: { type: 'string' },
      brandBrief: { type: 'string' },
      brandPainPoints: { type: 'array', items: { type: 'string' } },
      brandObjective: { type: 'string' },
      goals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
          },
        },
      },
      targetAudience: { type: 'object' },
      keyInsight: { type: 'string' },
      insightSource: { type: 'string' },
      strategyHeadline: { type: 'string' },
      strategyPillars: { type: 'array' },
      brandDescription: { type: 'string' },
      brandHighlights: { type: 'array', items: { type: 'string' } },
      brandOpportunity: { type: 'string' },
      activityTitle: { type: 'string' },
      activityConcept: { type: 'string' },
      activityDescription: { type: 'string' },
      activityApproach: { type: 'array' },
      activityDifferentiator: { type: 'string' },
      deliverables: { type: 'array' },
      deliverablesSummary: { type: 'string' },
      metrics: { type: 'object' },
      metricsExplanation: { type: 'string' },
      influencerStrategy: { type: 'string' },
      influencerCriteria: { type: 'array', items: { type: 'string' } },
      contentGuidelines: { type: 'array', items: { type: 'string' } },
      closingStatement: { type: 'string' },
      nextSteps: { type: 'array', items: { type: 'string' } },
      toneUsed: { type: 'string' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    },
    required: ['campaignName', 'brandDescription', 'goals', 'metrics', 'confidence'],
  };
}
