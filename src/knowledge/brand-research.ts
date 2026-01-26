/**
 * Brand Research Service
 * Deep brand research with Google Search grounding
 * Adapted from pptmaker
 */

import { getLLMManager } from '../llm/manager.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ component: 'BrandResearch' });

export interface BrandResearch {
  // Basic Info
  brandName: string;
  officialName: string;
  tagline?: string;
  industry: string;
  subIndustry?: string;
  founded: string;
  headquarters: string;
  website: string;

  // Company Overview
  companyDescription: string;
  historyHighlights: string[];
  businessModel: string;

  // Market Position
  marketPosition: string;
  marketShare?: string;
  competitors: {
    name: string;
    description: string;
    differentiator: string;
  }[];
  uniqueSellingPoints: string[];
  competitiveAdvantages: string[];

  // Products/Services
  mainProducts: {
    name: string;
    description: string;
    targetMarket?: string;
  }[];
  pricePositioning: 'budget' | 'mid-range' | 'premium' | 'luxury';

  // Target Audience
  targetDemographics: {
    primaryAudience: {
      gender: string;
      ageRange: string;
      socioeconomic: string;
      lifestyle: string;
      interests: string[];
      painPoints: string[];
      aspirations: string[];
    };
    secondaryAudience?: {
      gender: string;
      ageRange: string;
      description: string;
    };
    behavior: string;
    purchaseDrivers: string[];
  };

  // Brand Identity
  brandPersonality: string[];
  brandValues: string[];
  brandPromise: string;
  toneOfVoice: string;
  visualIdentity: {
    primaryColors: string[];
    style: string;
    moodKeywords: string[];
  };

  // Digital Presence
  socialPresence: {
    instagram?: { handle?: string; followers?: string; engagement?: string; contentStyle?: string };
    facebook?: { followers?: string; engagement?: string };
    tiktok?: { handle?: string; followers?: string; contentStyle?: string };
    youtube?: { subscribers?: string; contentType?: string };
    linkedin?: { followers?: string };
  };
  websiteTraffic?: string;
  onlineReputation?: string;

  // Influencer Marketing Context
  previousCampaigns: {
    name: string;
    description: string;
    results?: string;
  }[];
  influencerTypes: string[];
  contentThemes: string[];
  suggestedApproach: string;
  recommendedGoals: string[];
  potentialChallenges: string[];

  // Industry Insights
  industryTrends: string[];
  seasonality?: string;
  keyDates?: string[];

  // Sources
  sources: { title: string; url: string }[];

  // Confidence
  confidence: 'high' | 'medium' | 'low';
  researchNotes?: string;
}

export interface ScrapedWebsite {
  url: string;
  title: string;
  description: string;
  headings: string[];
  paragraphs: string[];
  socialLinks: string[];
}

const RESEARCH_PROMPT = `אתה חוקר מותגים בכיר עם 20 שנות ניסיון. בצע מחקר מעמיק ומקיף על המותג.

## הנחיות למחקר:
1. חפש מידע עדכני ומדויק
2. בדוק את הנוכחות ברשתות החברתיות
3. חפש כתבות, ראיונות, ופרסומים על המותג
4. נתח את הפוזיציה בשוק לעומת מתחרים
5. הבן את קהל היעד לעומק
6. זהה קמפיינים קודמים עם משפיענים

## חשוב מאוד:
- כתוב פסקאות מלאות ומפורטות, לא רק נקודות
- ספק ניתוח מעמיק, לא רק עובדות יבשות
- התבסס על מקורות אמיתיים
- אם אין מידע, ציין "לא נמצא מידע" ולא להמציא`;

/**
 * Deep research a brand using LLM
 */
export async function researchBrand(
  brandName: string,
  websiteData?: ScrapedWebsite
): Promise<BrandResearch> {
  log.info('Starting brand research', { brandName });

  const llm = getLLMManager();

  const websiteContext = websiteData
    ? `
## מידע שחולץ מהאתר הרשמי:
- כתובת: ${websiteData.url}
- כותרת: ${websiteData.title}
- תיאור: ${websiteData.description}
- כותרות מהאתר: ${websiteData.headings.slice(0, 15).join(' | ')}
- רשתות חברתיות שנמצאו: ${websiteData.socialLinks.join(', ')}
- תוכן מהאתר: 
${websiteData.paragraphs.slice(0, 10).join('\n')}
`
    : '';

  const fullPrompt = `${RESEARCH_PROMPT}

${websiteContext}

## המותג לחקור: "${brandName}"

החזר JSON מפורט בפורמט BrandResearch.`;

  try {
    const result = await llm.generateStructured<BrandResearch>(
      fullPrompt,
      getBrandResearchSchema(),
      'reasoning'
    );

    log.info('Brand research complete', {
      brandName,
      confidence: result.confidence,
      competitors: result.competitors?.length || 0,
    });

    return result;
  } catch (error) {
    log.error('Brand research failed', error as Error);
    return getMinimalResearch(brandName, websiteData);
  }
}

/**
 * Quick brand summary for validation
 */
export async function quickBrandSummary(brandName: string): Promise<{
  description: string;
  industry: string;
  targetAudience: string;
  toneOfVoice: string;
}> {
  const llm = getLLMManager();

  const prompt = `ספק סיכום קצר על המותג "${brandName}":
- description: תיאור קצר (2-3 משפטים)
- industry: תעשייה/קטגוריה
- targetAudience: תיאור קהל היעד
- toneOfVoice: סגנון התקשורת`;

  try {
    return await llm.generateStructured<{
      description: string;
      industry: string;
      targetAudience: string;
      toneOfVoice: string;
    }>(
      prompt,
      {
        type: 'object',
        properties: {
          description: { type: 'string' },
          industry: { type: 'string' },
          targetAudience: { type: 'string' },
          toneOfVoice: { type: 'string' },
        },
        required: ['description', 'industry', 'targetAudience', 'toneOfVoice'],
      },
      'reasoning'
    );
  } catch (error) {
    log.error('Quick summary failed', error as Error);
    return {
      description: `${brandName} הוא מותג ישראלי`,
      industry: 'לא ידוע',
      targetAudience: 'צרכנים ישראליים',
      toneOfVoice: 'מקצועי',
    };
  }
}

function getMinimalResearch(brandName: string, websiteData?: ScrapedWebsite): BrandResearch {
  return {
    brandName,
    officialName: brandName,
    industry: 'לא ידוע',
    founded: 'לא ידוע',
    headquarters: 'ישראל',
    website: websiteData?.url || '',
    companyDescription: `${brandName} הוא מותג ישראלי. נדרש מחקר נוסף.`,
    historyHighlights: [],
    businessModel: 'לא ידוע',
    marketPosition: 'נדרש מחקר נוסף',
    competitors: [],
    uniqueSellingPoints: [],
    competitiveAdvantages: [],
    mainProducts: [],
    pricePositioning: 'mid-range',
    targetDemographics: {
      primaryAudience: {
        gender: 'נשים וגברים',
        ageRange: '25-45',
        socioeconomic: 'בינוני-גבוה',
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
    previousCampaigns: [],
    influencerTypes: ['לייפסטייל', 'מומחים בתחום'],
    contentThemes: [],
    suggestedApproach: 'שיתוף פעולה עם משפיענים רלוונטיים',
    recommendedGoals: ['מודעות', 'חשיפה', 'אמינות'],
    potentialChallenges: [],
    industryTrends: [],
    sources: [],
    confidence: 'low',
    researchNotes: 'המחקר האוטומטי לא הצליח לאסוף מידע מספק.',
  };
}

function getBrandResearchSchema(): object {
  return {
    type: 'object',
    properties: {
      brandName: { type: 'string' },
      officialName: { type: 'string' },
      tagline: { type: 'string' },
      industry: { type: 'string' },
      subIndustry: { type: 'string' },
      founded: { type: 'string' },
      headquarters: { type: 'string' },
      website: { type: 'string' },
      companyDescription: { type: 'string' },
      historyHighlights: { type: 'array', items: { type: 'string' } },
      businessModel: { type: 'string' },
      marketPosition: { type: 'string' },
      marketShare: { type: 'string' },
      competitors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            differentiator: { type: 'string' },
          },
        },
      },
      uniqueSellingPoints: { type: 'array', items: { type: 'string' } },
      competitiveAdvantages: { type: 'array', items: { type: 'string' } },
      mainProducts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            targetMarket: { type: 'string' },
          },
        },
      },
      pricePositioning: { type: 'string', enum: ['budget', 'mid-range', 'premium', 'luxury'] },
      targetDemographics: { type: 'object' },
      brandPersonality: { type: 'array', items: { type: 'string' } },
      brandValues: { type: 'array', items: { type: 'string' } },
      brandPromise: { type: 'string' },
      toneOfVoice: { type: 'string' },
      visualIdentity: { type: 'object' },
      socialPresence: { type: 'object' },
      websiteTraffic: { type: 'string' },
      onlineReputation: { type: 'string' },
      previousCampaigns: { type: 'array' },
      influencerTypes: { type: 'array', items: { type: 'string' } },
      contentThemes: { type: 'array', items: { type: 'string' } },
      suggestedApproach: { type: 'string' },
      recommendedGoals: { type: 'array', items: { type: 'string' } },
      potentialChallenges: { type: 'array', items: { type: 'string' } },
      industryTrends: { type: 'array', items: { type: 'string' } },
      seasonality: { type: 'string' },
      keyDates: { type: 'array', items: { type: 'string' } },
      sources: { type: 'array' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      researchNotes: { type: 'string' },
    },
    required: ['brandName', 'industry', 'companyDescription', 'confidence'],
  };
}
