/**
 * Intent Classifier
 * Classifies user input into intent + entities
 * Runs BEFORE Planner
 */

import { getLLMManager } from '../llm/manager.js';
import { logger } from '../utils/logger.js';
import { logAudit } from '../db/repositories/audit.repo.js';
import type { Intent, IntentType, IntentEntities } from '../types/agent.types.js';

const log = logger.child({ component: 'IntentClassifier' });

const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    primary: {
      type: 'string',
      enum: [
        'media_strategy',
        'media_performance',
        'sales_tracking',
        'sales_followup',
        'sales_email',
        'influencer_research',
        'influencer_concept',
        'hr_satisfaction',
        'hr_feedback',
        'calendar_query',
        'calendar_create',
        'generate_proposal',
        'general_question',
        'clarification_needed',
        'unknown',
      ],
    },
    secondary: {
      type: 'string',
      enum: [
        'media_strategy',
        'media_performance',
        'sales_tracking',
        'sales_followup',
        'sales_email',
        'influencer_research',
        'influencer_concept',
        'hr_satisfaction',
        'hr_feedback',
        'calendar_query',
        'calendar_create',
        'generate_proposal',
        'general_question',
        'clarification_needed',
        'unknown',
        null,
      ],
    },
    entities: {
      type: 'object',
      properties: {
        clientName: { type: 'string' },
        domain: { type: 'string' },
        action: { type: 'string' },
        timeframe: { type: 'string' },
        budget: { type: 'number' },
        custom: { type: 'object' },
      },
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['primary', 'entities', 'confidence'],
};

const CLASSIFICATION_PROMPT = `אתה מסווג כוונות (Intent Classifier) במערכת AI לסוכנות שיווק.

תפקידך לנתח את הקלט ולזהות:
1. הכוונה העיקרית (primary intent)
2. כוונה משנית אם יש (secondary intent)
3. ישויות (entities) - שם לקוח, תחום, פעולה, מסגרת זמן, תקציב
4. רמת ביטחון (0-1)

סוגי כוונות אפשריים:
- media_strategy: בניית אסטרטגיית מדיה
- media_performance: ניתוח ביצועי מדיה/קמפיינים
- sales_tracking: מעקב אחרי דילים/מכירות
- sales_followup: follow-up לדיל תקוע
- sales_email: כתיבת מייל מכירתי
- influencer_research: מחקר משפיענים
- influencer_concept: רעיונות לקמפיין משפיענים
- hr_satisfaction: ניתוח שביעות רצון עובדים
- hr_feedback: כתיבת משוב HR
- calendar_query: שאלה על יומן/פגישות
- calendar_create: יצירת אירוע ביומן
- generate_proposal: יצירת הצעת מחיר
- create_quote: יצירת הצעה
- research_brand: מחקר מותג
- prepare_meeting: הכנה לפגישה
- influencer_kpi: חישוב KPI משפיענים
- creative_ideas: רעיונות קריאייטיב
- general_question: שאלה כללית
- clarification_needed: צריך הבהרה מהמשתמש
- unknown: לא ניתן לזהות

דוגמאות:
- "יש לנו לקוח בשם סיקרט, תבדוק מה אתה יודע עליו ותציע אסטרטגיית מדיה" 
  → primary: media_strategy, entities: { clientName: "סיקרט" }

- "מה הסטטוס של הדיל עם חברת ABC?"
  → primary: sales_tracking, entities: { clientName: "ABC" }

- "תכין הצעת מחיר לקמפיין משפיענים, תקציב 50 אלף"
  → primary: generate_proposal, entities: { budget: 50000 }

הקלט לניתוח:
`;

/**
 * Classify user input into intent
 */
export async function classifyIntent(
  rawInput: string,
  jobId?: string,
  userId?: string
): Promise<Intent> {
  log.info('Classifying intent', { inputLength: rawInput.length });

  const llm = getLLMManager();

  try {
    const result = await llm.generateStructured<{
      primary: IntentType;
      secondary?: IntentType;
      entities: IntentEntities & { custom?: Record<string, string> };
      confidence: number;
    }>(
      `${CLASSIFICATION_PROMPT}\n"${rawInput}"`,
      INTENT_SCHEMA,
      'reasoning' // Use Gemini for classification
    );

    const intent: Intent = {
      primary: result.primary,
      secondary: result.secondary,
      entities: {
        clientName: result.entities.clientName,
        domain: result.entities.domain,
        action: result.entities.action,
        timeframe: result.entities.timeframe,
        custom: result.entities.custom || {},
      },
      confidence: result.confidence,
    };

    log.info('Intent classified', {
      primary: intent.primary,
      confidence: intent.confidence,
      clientName: intent.entities.clientName,
    });

    // Audit
    if (jobId) {
      await logAudit('intent.classified', intent as unknown as Record<string, unknown>, { jobId, userId });
    }

    return intent;
  } catch (error) {
    log.error('Intent classification failed', error as Error);

    // Return unknown intent on failure
    return {
      primary: 'unknown',
      entities: { custom: {} },
      confidence: 0,
    };
  }
}

/**
 * Check if intent needs clarification
 */
export function needsClarification(intent: Intent): boolean {
  return (
    intent.primary === 'clarification_needed' ||
    intent.primary === 'unknown' ||
    intent.confidence < 0.5
  );
}

/**
 * Get clarification prompt for user
 */
export function getClarificationPrompt(intent: Intent, _rawInput: string): string {
  if (intent.primary === 'unknown') {
    return 'לא הצלחתי להבין מה אתה צריך. אפשר לפרט יותר?';
  }

  if (intent.confidence < 0.5) {
    return `לא בטוח שהבנתי נכון. התכוונת ל${getIntentDescription(intent.primary)}?`;
  }

  return 'אפשר לפרט קצת יותר על מה שאתה צריך?';
}

function getIntentDescription(intent: IntentType): string {
  const descriptions: Record<IntentType, string> = {
    media_strategy: 'בניית אסטרטגיית מדיה',
    media_performance: 'ניתוח ביצועי מדיה',
    sales_tracking: 'מעקב אחרי דילים',
    sales_followup: 'follow-up לדיל',
    sales_email: 'כתיבת מייל מכירתי',
    influencer_research: 'מחקר משפיענים',
    influencer_concept: 'רעיונות לקמפיין',
    hr_satisfaction: 'ניתוח שביעות רצון',
    hr_feedback: 'כתיבת משוב',
    calendar_query: 'שאלה על יומן',
    calendar_create: 'יצירת אירוע',
    generate_proposal: 'הצעת מחיר',
    create_quote: 'הצעת מחיר',
    annual_strategy: 'אסטרטגיה שנתית',
    research_brand: 'מחקר מותג',
    prepare_meeting: 'הכנה לפגישה',
    competitor_analysis: 'ניתוח מתחרים',
    deep_research: 'מחקר עומק',
    media_deliverables: 'תוצרים מדיה',
    customer_satisfaction: 'שביעות רצון לקוח',
    influencer_kpi: 'KPI משפיענים',
    creative_ideas: 'רעיונות קריאייטיב',
    brand_brain: 'מוח מותג',
    creative_format: 'פורמט קריאייטיב',
    production_deck: 'מצגת הפקה',
    supplier_match: 'התאמת ספק',
    budget_check: 'בדיקת תקציב',
    meeting_summary: 'סיכום פגישה',
    weekly_status: 'סטטוס שבועי',
    bottleneck_detection: 'איתור צווארי בקבוק',
    billing_control: 'בקרת חיובים',
    cashflow: 'תזרים מזומנים',
    general_question: 'שאלה כללית',
    clarification_needed: 'הבהרה',
    unknown: 'משהו אחר',
  };

  return descriptions[intent] || 'משהו אחר';
}

