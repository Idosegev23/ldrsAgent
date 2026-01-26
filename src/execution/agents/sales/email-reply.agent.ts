/**
 * Sales Email Reply Agent
 * Generates professional sales email responses
 */

import { BaseAgent } from '../../base-agent.js';
import { getLLMManager } from '../../../llm/manager.js';
import type { Job, AgentResult, Intent } from '../../../types/index.js';

export class SalesEmailReplyAgent extends BaseAgent {
  id = 'sales/email-reply';
  name = 'Sales Email Reply Writer';
  nameHebrew = 'כותב תשובות מייל מכירות';
  layer = 2 as const;
  domain = 'sales';
  description = 'מנסח תשובות מייל מכירתיות איכותיות';
  capabilities = [
    'email-writing',
    'sales-communication',
    'objection-handling',
    'tone-adaptation',
  ];

  canHandle(intent: Intent): boolean {
    if (intent.primary === 'sales_email') return true;
    return false;
  }

  async execute(job: Job): Promise<AgentResult> {
    const jobLog = this.log.child({ jobId: job.id });
    jobLog.info('Generating sales email reply');

    try {
      const params = this.extractParameters(job.rawInput);

      if (!params.originalEmail && !params.context) {
        return this.failure('לא סופק תוכן המייל המקורי או הקשר. אנא ציין את המייל שצריך לענות עליו.');
      }

      // Analyze the email context
      const analysis = await this.analyzeEmail(params);

      // Generate reply options
      const replies = await this.generateReplies(params, analysis);

      // Format output
      const output = this.formatOutput(params, analysis, replies);

      return this.success(output, {
        structured: { params, analysis, replies },
        confidence: 'high',
      });
    } catch (error) {
      jobLog.error('Email reply generation failed', error as Error);
      return this.failure('אירעה שגיאה ביצירת התשובה');
    }
  }

  private extractParameters(input: string): EmailParams {
    const params: EmailParams = {};

    // Try to extract original email
    const emailMatch = input.match(/(?:מייל|email|פנייה)[:\s]*["']?([^"']+)["']?/i);
    if (emailMatch) params.originalEmail = emailMatch[1].trim();

    // If no specific email, use the whole input as context
    if (!params.originalEmail) {
      params.context = input;
    }

    // Extract client name
    const clientMatch = input.match(/(?:לקוח|מ|from)[:\s]+([^\n,]+)/i);
    if (clientMatch) params.clientName = clientMatch[1].trim();

    // Extract deal stage
    if (input.includes('ראשוני') || input.includes('חדש')) params.stage = 'initial';
    else if (input.includes('הצעה')) params.stage = 'proposal';
    else if (input.includes('משא ומתן')) params.stage = 'negotiation';
    else if (input.includes('סגירה')) params.stage = 'closing';

    // Extract tone preference
    if (input.includes('רשמי') || input.includes('פורמלי')) params.tone = 'formal';
    else if (input.includes('חברותי') || input.includes('קליל')) params.tone = 'friendly';
    else params.tone = 'professional';

    // Extract urgency
    if (input.includes('דחוף') || input.includes('מהר')) params.urgency = 'high';
    else params.urgency = 'normal';

    return params;
  }

  private async analyzeEmail(params: EmailParams): Promise<EmailAnalysis> {
    const content = params.originalEmail || params.context || '';
    
    // Detect intent from content
    let detectedIntent: string = 'general_inquiry';
    if (content.includes('מחיר') || content.includes('עלות')) detectedIntent = 'pricing_question';
    else if (content.includes('מתי') || content.includes('זמן')) detectedIntent = 'timeline_question';
    else if (content.includes('יקר') || content.includes('תקציב')) detectedIntent = 'price_objection';
    else if (content.includes('מתחר') || content.includes('אחר')) detectedIntent = 'competitor_comparison';
    else if (content.includes('מעניין') || content.includes('רוצה')) detectedIntent = 'interest_signal';
    else if (content.includes('לא') || content.includes('אין')) detectedIntent = 'objection';

    // Detect sentiment
    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (content.includes('תודה') || content.includes('מעולה') || content.includes('מעניין')) {
      sentiment = 'positive';
    } else if (content.includes('לא') || content.includes('בעיה') || content.includes('יקר')) {
      sentiment = 'negative';
    }

    // Suggest response approach
    const approach = this.determineApproach(detectedIntent, sentiment);

    return {
      detectedIntent,
      sentiment,
      suggestedApproach: approach,
      keyPoints: this.extractKeyPoints(content),
    };
  }

  private determineApproach(intent: string, sentiment: string): string {
    const approaches: Record<string, Record<string, string>> = {
      'pricing_question': {
        'positive': 'הצג ערך ואז מחיר',
        'neutral': 'שאל על צרכים לפני מחיר',
        'negative': 'הדגש ROI וערך',
      },
      'price_objection': {
        'positive': 'הצע תוכנית תשלומים',
        'neutral': 'הסבר את הערך',
        'negative': 'הצע אלטרנטיבה מצומצמת',
      },
      'competitor_comparison': {
        'positive': 'הדגש יתרונות ייחודיים',
        'neutral': 'שאל מה חשוב להם',
        'negative': 'הצע שיחה להשוואה',
      },
      'interest_signal': {
        'positive': 'קדם לשלב הבא',
        'neutral': 'שאל שאלות מעמיקות',
        'negative': 'בדוק מה מעכב',
      },
    };

    return approaches[intent]?.[sentiment] || 'תן מענה מקצועי וידידותי';
  }

  private extractKeyPoints(content: string): string[] {
    const points: string[] = [];
    
    // Extract questions
    const questions = content.match(/[^.!?]*\?/g);
    if (questions) {
      points.push(...questions.map(q => q.trim()));
    }

    // Extract keywords
    const keywords = ['מחיר', 'זמן', 'תקציב', 'עלות', 'פגישה', 'הצעה'];
    for (const kw of keywords) {
      if (content.includes(kw)) {
        points.push(`נושא: ${kw}`);
      }
    }

    return points.slice(0, 5);
  }

  private async generateReplies(
    params: EmailParams,
    analysis: EmailAnalysis,
    _unusedParams?: unknown
  ): Promise<EmailReply[]> {
    const llm = getLLMManager();
    const replies: EmailReply[] = [];

    // Generate main reply
    const mainPrompt = `כתוב תשובה למייל מכירות.

קונטקסט: ${params.originalEmail || params.context}
שלב הדיל: ${params.stage || 'לא ידוע'}
טון: ${params.tone || 'מקצועי'}
גישה מומלצת: ${analysis.suggestedApproach}

כללים:
1. התחל בהתייחסות לנקודה שהלקוח העלה
2. תן ערך או מידע רלוונטי
3. סיים עם קריאה לפעולה ברורה
4. אורך: 50-100 מילים
5. בעברית

כתוב רק את גוף המייל, בלי "שלום" או חתימה.`;

    const mainReply = await llm.complete(mainPrompt, 'writing');

    replies.push({
      type: 'main',
      subject: this.generateSubject(analysis, params),
      body: this.formatEmailBody(mainReply, params),
      tone: params.tone || 'professional',
    });

    // Generate short alternative
    const shortPrompt = `כתוב תשובה קצרה וישירה (עד 30 מילים) לאותו מייל:
${params.originalEmail || params.context}

מטרה: ${analysis.suggestedApproach}
בעברית בלבד.`;

    const shortReply = await llm.complete(shortPrompt, 'writing');

    replies.push({
      type: 'short',
      subject: this.generateSubject(analysis, params),
      body: this.formatEmailBody(shortReply, params),
      tone: 'concise',
    });

    return replies;
  }

  private generateSubject(analysis: EmailAnalysis, _params: EmailParams): string {
    const subjects: Record<string, string> = {
      'pricing_question': 'Re: פרטים נוספים והצעה מותאמת',
      'price_objection': 'Re: אפשרויות התאמה לתקציב',
      'competitor_comparison': 'Re: למה לבחור בנו',
      'interest_signal': 'Re: השלב הבא',
      'timeline_question': 'Re: לוחות זמנים ותהליך',
      'objection': 'Re: נשמח להתייחס',
      'general_inquiry': 'Re: תודה על הפנייה',
    };

    return subjects[analysis.detectedIntent] || 'Re: תשובה לפנייתך';
  }

  private formatEmailBody(content: string, params: EmailParams): string {
    const greeting = params.clientName 
      ? `שלום ${params.clientName},`
      : 'שלום רב,';

    const signature = `
בברכה,
[שמך]
[תפקיד]
[טלפון]`;

    return `${greeting}

${content.trim()}

${signature}`;
  }

  private formatOutput(
    _params: EmailParams,
    analysis: EmailAnalysis,
    replies: EmailReply[]
  ): string {
    const lines: string[] = [
      '# 📧 תשובת מייל מכירות',
      '',
      '---',
      '',
      '## ניתוח הפנייה',
      '',
      `**כוונה שזוהתה:** ${this.getIntentHebrew(analysis.detectedIntent)}`,
      `**סנטימנט:** ${this.getSentimentHebrew(analysis.sentiment)}`,
      `**גישה מומלצת:** ${analysis.suggestedApproach}`,
      '',
    ];

    if (analysis.keyPoints.length > 0) {
      lines.push('**נקודות מפתח:**');
      lines.push(...analysis.keyPoints.map(p => `- ${p}`));
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('## תשובות מוצעות');
    lines.push('');

    for (const reply of replies) {
      const typeName = reply.type === 'main' ? 'תשובה מלאה' : 'תשובה קצרה';
      lines.push(`### ${typeName}`);
      lines.push('');
      lines.push(`**נושא:** ${reply.subject}`);
      lines.push('');
      lines.push('```');
      lines.push(reply.body);
      lines.push('```');
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('*בחר את התשובה המתאימה והתאם לפי הצורך*');

    return lines.join('\n');
  }

  private getIntentHebrew(intent: string): string {
    const intents: Record<string, string> = {
      'pricing_question': 'שאלת מחיר',
      'price_objection': 'התנגדות מחיר',
      'competitor_comparison': 'השוואה למתחרים',
      'interest_signal': 'סימן עניין',
      'timeline_question': 'שאלת זמנים',
      'objection': 'התנגדות כללית',
      'general_inquiry': 'פנייה כללית',
    };
    return intents[intent] || intent;
  }

  private getSentimentHebrew(sentiment: string): string {
    const sentiments: Record<string, string> = {
      'positive': 'חיובי',
      'neutral': 'ניטרלי',
      'negative': 'שלילי',
    };
    return sentiments[sentiment] || sentiment;
  }
}

interface EmailParams {
  originalEmail?: string;
  context?: string;
  clientName?: string;
  stage?: string;
  tone?: string;
  urgency?: string;
}

interface EmailAnalysis {
  detectedIntent: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  suggestedApproach: string;
  keyPoints: string[];
}

interface EmailReply {
  type: 'main' | 'short' | 'formal';
  subject: string;
  body: string;
  tone: string;
}
