/**
 * Influencer Research Service
 * Recommends relevant influencers for brands
 * Adapted from pptmaker
 */

import { getLLMManager } from '../llm/manager.js';
import { logger } from '../utils/logger.js';
import type { BrandResearch } from './brand-research.js';

const log = logger.child({ component: 'InfluencerResearch' });

export interface InfluencerRecommendation {
  name: string;
  handle: string;
  platform: 'instagram' | 'tiktok' | 'youtube';
  category: string;
  followers: string;
  engagement: string;
  avgStoryViews?: string;
  whyRelevant: string;
  contentStyle: string;
  estimatedCost: string;
  profileUrl: string;
  profilePicUrl?: string;
}

export interface InfluencerTier {
  name: string;
  description: string;
  recommendedCount: number;
  budgetAllocation: string;
  purpose: string;
}

export interface ContentTheme {
  theme: string;
  description: string;
  examples: string[];
}

export interface InfluencerKPI {
  metric: string;
  target: string;
  rationale: string;
}

export interface TimelinePhase {
  phase: string;
  duration: string;
  activities: string[];
}

export interface Risk {
  risk: string;
  mitigation: string;
}

export interface InfluencerStrategy {
  strategyTitle: string;
  strategySummary: string;
  tiers: InfluencerTier[];
  recommendations: InfluencerRecommendation[];
  contentThemes: ContentTheme[];
  expectedKPIs: InfluencerKPI[];
  suggestedTimeline: TimelinePhase[];
  potentialRisks: Risk[];
}

/**
 * Research and recommend influencers for a brand
 */
export async function researchInfluencers(
  brandResearch: BrandResearch,
  budget: number,
  goals: string[]
): Promise<InfluencerStrategy> {
  log.info('Starting influencer research', {
    brand: brandResearch.brandName,
    budget,
    goals,
  });

  const llm = getLLMManager();

  const prompt = `אתה מומחה שיווק משפיענים בכיר עם 15 שנות ניסיון בשוק הישראלי.
בצע מחקר מעמיק והמלץ על אסטרטגיית משפיענים עבור המותג.

## פרטי המותג:
- שם: ${brandResearch.brandName}
- תעשייה: ${brandResearch.industry}
- קהל יעד: ${brandResearch.targetDemographics?.primaryAudience?.gender || 'לא ידוע'}, ${brandResearch.targetDemographics?.primaryAudience?.ageRange || '25-45'}
- תחומי עניין של הקהל: ${brandResearch.targetDemographics?.primaryAudience?.interests?.join(', ') || 'לא ידוע'}
- ערכי מותג: ${brandResearch.brandValues?.join(', ') || 'לא ידוע'}
- טון מותג: ${brandResearch.toneOfVoice}
- מתחרים: ${brandResearch.competitors?.map((c) => c.name).join(', ') || 'לא ידוע'}

## תקציב: ${budget.toLocaleString()} ש"ח
## מטרות הקמפיין: ${goals.join(', ')}

## המשימה שלך:
1. חפש משפיענים ישראליים אמיתיים שמתאימים למותג
2. הצע אסטרטגיית שכבות (Mega, Macro, Micro, Nano)
3. הצע נושאי תוכן ספציפיים
4. הגדר KPIs ריאליסטיים
5. תכנן לוח זמנים

## חשוב:
- השתמש בשמות משפיענים ישראליים אמיתיים
- התייחס לשוק הישראלי
- חשב עלויות ריאליסטיות לשוק המקומי

המלץ על 6-10 משפיענים ספציפיים.`;

  try {
    const strategy = await llm.generateStructured<InfluencerStrategy>(
      prompt,
      getInfluencerStrategySchema(),
      'reasoning'
    );

    log.info('Influencer research complete', {
      brand: brandResearch.brandName,
      recommendations: strategy.recommendations?.length || 0,
    });

    return strategy;
  } catch (error) {
    log.error('Influencer research failed', error as Error);
    return getDefaultStrategy(brandResearch, budget, goals);
  }
}

/**
 * Quick influencer suggestions (less detailed)
 */
export async function getQuickInfluencerSuggestions(
  industry: string,
  targetAudience: string,
  budget: number
): Promise<InfluencerRecommendation[]> {
  const llm = getLLMManager();

  const prompt = `הצע 5 משפיענים ישראליים מתאימים לקמפיין:
- תעשייה: ${industry}
- קהל יעד: ${targetAudience}
- תקציב: ${budget.toLocaleString()} ש"ח

החזר רשימה של 5 משפיענים עם: name, handle, platform, category, followers, engagement, whyRelevant, contentStyle, estimatedCost, profileUrl`;

  try {
    return await llm.generateStructured<InfluencerRecommendation[]>(
      prompt,
      {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            handle: { type: 'string' },
            platform: { type: 'string', enum: ['instagram', 'tiktok', 'youtube'] },
            category: { type: 'string' },
            followers: { type: 'string' },
            engagement: { type: 'string' },
            whyRelevant: { type: 'string' },
            contentStyle: { type: 'string' },
            estimatedCost: { type: 'string' },
            profileUrl: { type: 'string' },
          },
        },
      },
      'reasoning'
    );
  } catch (error) {
    log.error('Quick influencer suggestions failed', error as Error);
    return [];
  }
}

/**
 * Calculate influencer KPIs based on data
 */
export interface InfluencerKPIInput {
  influencerCount: number;
  deliverables: { type: string; count: number }[];
  campaignDuration: number;
  budget: number;
}

export interface CalculatedKPIs {
  expectedReach: number;
  expectedEngagement: number;
  cpe: number;
  cpm: number;
  estimatedImpressions: number;
  explanation: string;
}

export function calculateInfluencerKPIs(input: InfluencerKPIInput): CalculatedKPIs {
  // Industry averages for Israeli market
  const AVG_REACH_PER_INFLUENCER = 50000;
  const AVG_ENGAGEMENT_RATE = 0.035;

  const totalDeliverables = input.deliverables.reduce((sum, d) => sum + d.count, 0);
  const expectedReach = input.influencerCount * AVG_REACH_PER_INFLUENCER * totalDeliverables;
  const expectedEngagement = Math.round(expectedReach * AVG_ENGAGEMENT_RATE);
  const cpe = input.budget / expectedEngagement;
  const cpm = (input.budget / expectedReach) * 1000;

  return {
    expectedReach,
    expectedEngagement,
    cpe: Math.round(cpe * 100) / 100,
    cpm: Math.round(cpm * 100) / 100,
    estimatedImpressions: expectedReach * 1.5,
    explanation: `הערכה מבוססת על ${input.influencerCount} משפיענים עם ${totalDeliverables} תוצרים לאורך ${input.campaignDuration} ימים`,
  };
}

function getDefaultStrategy(
  brandResearch: BrandResearch,
  budget: number,
  goals: string[]
): InfluencerStrategy {
  return {
    strategyTitle: `אסטרטגיית משפיענים עבור ${brandResearch.brandName}`,
    strategySummary: `אסטרטגיה משולבת הכוללת משפיענים בגדלים שונים להשגת ${goals.join(' ו-')}.`,

    tiers: [
      {
        name: 'Macro Influencers',
        description: 'משפיענים עם 100K+ עוקבים',
        recommendedCount: 2,
        budgetAllocation: '40%',
        purpose: 'חשיפה ומודעות',
      },
      {
        name: 'Micro Influencers',
        description: 'משפיענים עם 10K-100K עוקבים',
        recommendedCount: 4,
        budgetAllocation: '35%',
        purpose: 'מעורבות והמרות',
      },
      {
        name: 'Nano Influencers',
        description: 'משפיענים עם 1K-10K עוקבים',
        recommendedCount: 6,
        budgetAllocation: '25%',
        purpose: 'אותנטיות וקהילה',
      },
    ],

    recommendations: [],

    contentThemes: [
      {
        theme: 'שגרה יומית',
        description: 'שילוב המוצר בשגרת היום של המשפיען',
        examples: ['בוקר טוב עם המוצר', 'לפני/אחרי', 'השוואה'],
      },
      {
        theme: 'ביקורת אמיתית',
        description: 'חוות דעת כנה על המוצר',
        examples: ['ראשונים לנסות', 'חודש עם המוצר', 'התוצאות'],
      },
    ],

    expectedKPIs: [
      {
        metric: 'Reach',
        target: Math.round(budget * 5).toLocaleString(),
        rationale: 'לפי CPM ממוצע בשוק',
      },
      {
        metric: 'Engagement',
        target: Math.round(budget / 2.5).toLocaleString(),
        rationale: 'לפי CPE ממוצע',
      },
    ],

    suggestedTimeline: [
      {
        phase: 'הכנה',
        duration: '2 שבועות',
        activities: ['בחירת משפיענים', 'חוזים', 'בריף'],
      },
      {
        phase: 'ביצוע',
        duration: '4 שבועות',
        activities: ['יצירה', 'פרסום', 'ניטור'],
      },
    ],

    potentialRisks: [
      {
        risk: 'אי עמידה בדדליינים',
        mitigation: 'תיאום מראש וגמישות בלו"ז',
      },
    ],
  };
}

function getInfluencerStrategySchema(): object {
  return {
    type: 'object',
    properties: {
      strategyTitle: { type: 'string' },
      strategySummary: { type: 'string' },
      tiers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            recommendedCount: { type: 'number' },
            budgetAllocation: { type: 'string' },
            purpose: { type: 'string' },
          },
        },
      },
      recommendations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            handle: { type: 'string' },
            platform: { type: 'string' },
            category: { type: 'string' },
            followers: { type: 'string' },
            engagement: { type: 'string' },
            avgStoryViews: { type: 'string' },
            whyRelevant: { type: 'string' },
            contentStyle: { type: 'string' },
            estimatedCost: { type: 'string' },
            profileUrl: { type: 'string' },
          },
        },
      },
      contentThemes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            theme: { type: 'string' },
            description: { type: 'string' },
            examples: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      expectedKPIs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            metric: { type: 'string' },
            target: { type: 'string' },
            rationale: { type: 'string' },
          },
        },
      },
      suggestedTimeline: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            phase: { type: 'string' },
            duration: { type: 'string' },
            activities: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      potentialRisks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            risk: { type: 'string' },
            mitigation: { type: 'string' },
          },
        },
      },
    },
    required: ['strategyTitle', 'strategySummary', 'tiers', 'recommendations'],
  };
}
