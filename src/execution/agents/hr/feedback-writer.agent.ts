/**
 * HR & Feedback Writing Agent
 * Agent #26 from the Multi-Agent System table
 * 
 * Uses LONG CONTEXT to:
 * 1. Assist in formulating management messages adapted to situation
 * 2. Match content to audience and required sensitivity
 * 3. Maintain respect and clarity
 * 
 * Input: Situation context, employee details, message type
 * Output: Professional HR communication (emails, feedback, reviews)
 */

import { BaseAgent } from '../../base-agent.js';
import { getLLMManager } from '../../../llm/manager.js';
import type { Job, AgentResult, Intent } from '../../../types/index.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class HRFeedbackWriterAgent extends BaseAgent {
  id = 'hr/feedback-writer';
  name = 'HR Email & Feedback Writer';
  nameHebrew = 'כותב מיילים ומשובים HR';
  layer = 2 as const;
  domain = 'hr';
  description = 'כותב מיילים, משובים והערכות לעובדים בטון מקצועי';
  capabilities = [
    'hr-email-writing',
    'feedback-formulation',
    'performance-review',
    'tone-adaptation',
  ];
  
  // Agent #26 - Uses LONG CONTEXT
  protected geminiTools: GeminiTool[] = [];

  canHandle(intent: Intent): boolean {
    if (intent.primary === 'hr_feedback') return true;
    return false;
  }

  async execute(job: Job): Promise<AgentResult> {
    const jobLog = this.log.child({ jobId: job.id });
    jobLog.info('Generating HR feedback');

    try {
      const params = this.extractParameters(job.rawInput);

      if (!params.type) {
        return this.failure('לא צוין סוג המסמך הנדרש (משוב, הערכה, מייל)');
      }

      // Generate the document
      const document = await this.generateDocument(params);

      // Format output
      const output = this.formatOutput(params, document);

      return this.success(output, {
        structured: { params, document },
        confidence: 'high',
      });
    } catch (error) {
      jobLog.error('HR feedback generation failed', error as Error);
      return this.failure('אירעה שגיאה ביצירת המסמך');
    }
  }

  private extractParameters(input: string): FeedbackParams {
    const params: FeedbackParams = {};

    // Determine type
    if (input.includes('משוב') || input.includes('feedback')) {
      params.type = 'feedback';
    } else if (input.includes('הערכה') || input.includes('review')) {
      params.type = 'review';
    } else if (input.includes('מייל') || input.includes('email')) {
      params.type = 'email';
    } else if (input.includes('הודעה')) {
      params.type = 'announcement';
    }

    // Extract employee name
    const nameMatch = input.match(/(?:לעובד|עבור|ל)\s+([א-ת]+(?:\s+[א-ת]+)?)/);
    if (nameMatch) params.employeeName = nameMatch[1].trim();

    // Extract context/topic
    if (input.includes('שנתי')) params.context = 'annual_review';
    else if (input.includes('חצי שנתי')) params.context = 'mid_year_review';
    else if (input.includes('מבחן')) params.context = 'probation_review';
    else if (input.includes('יום הולדת')) params.context = 'birthday';
    else if (input.includes('ותק')) params.context = 'anniversary';
    else if (input.includes('סיום')) params.context = 'termination';
    else if (input.includes('קבלה')) params.context = 'hiring';

    // Extract tone
    if (input.includes('חיובי') || input.includes('שבח')) params.tone = 'positive';
    else if (input.includes('קונסטרוקטיבי')) params.tone = 'constructive';
    else if (input.includes('רשמי')) params.tone = 'formal';
    else params.tone = 'professional';

    // Extract specific points
    const pointsMatch = input.match(/(?:על|בנושא|לגבי)\s+([^.]+)/g);
    if (pointsMatch) {
      params.specificPoints = pointsMatch.map(p => p.replace(/^(?:על|בנושא|לגבי)\s+/, '').trim());
    }

    return params;
  }

  private async generateDocument(params: FeedbackParams): Promise<GeneratedDocument> {
    const llm = getLLMManager();

    const templates: Record<string, string> = {
      feedback: this.getFeedbackPrompt(params),
      review: this.getReviewPrompt(params),
      email: this.getEmailPrompt(params),
      announcement: this.getAnnouncementPrompt(params),
    };

    const prompt = templates[params.type || 'email'];
    const content = await llm.complete(prompt, 'writing');

    return {
      type: params.type || 'email',
      content: content.trim(),
      subject: this.generateSubject(params),
      tone: params.tone || 'professional',
    };
  }

  private getFeedbackPrompt(params: FeedbackParams): string {
    return `כתוב משוב מקצועי לעובד ${params.employeeName || '[שם העובד]'}.
טון: ${params.tone || 'מקצועי'}
${params.specificPoints ? `נקודות לכלול: ${params.specificPoints.join(', ')}` : ''}

מבנה המשוב:
1. פתיחה חיובית
2. נקודות חוזק (2-3)
3. תחומים לשיפור (1-2)
4. סיכום ועידוד

אורך: 150-200 מילים
בעברית מקצועית.`;
  }

  private getReviewPrompt(params: FeedbackParams): string {
    const reviewType = params.context === 'annual_review' ? 'שנתית' :
                       params.context === 'mid_year_review' ? 'חצי שנתית' :
                       params.context === 'probation_review' ? 'תקופת ניסיון' : 'תקופתית';

    return `כתוב הערכת ביצועים ${reviewType} לעובד ${params.employeeName || '[שם העובד]'}.

מבנה ההערכה:
1. סקירה כללית של התקופה
2. הישגים עיקריים
3. עמידה ביעדים
4. נקודות חוזק
5. תחומים להתפתחות
6. יעדים לתקופה הבאה
7. סיכום

טון: ${params.tone || 'מקצועי ואובייקטיבי'}
אורך: 300-400 מילים
בעברית מקצועית.`;
  }

  private getEmailPrompt(params: FeedbackParams): string {
    const contextMap: Record<string, string> = {
      'birthday': 'ברכת יום הולדת',
      'anniversary': 'ברכת ותק',
      'hiring': 'קבלה לעבודה',
      'termination': 'סיום העסקה',
    };

    const emailType = params.context ? contextMap[params.context] : 'כללי';

    return `כתוב מייל HR מקצועי.
סוג: ${emailType}
נמען: ${params.employeeName || 'עובד'}
${params.specificPoints ? `נושאים: ${params.specificPoints.join(', ')}` : ''}

טון: ${params.tone || 'מקצועי וחם'}
אורך: 50-100 מילים
כולל פתיחה וחתימה.`;
  }

  private getAnnouncementPrompt(params: FeedbackParams): string {
    return `כתוב הודעה ארגונית.
${params.specificPoints ? `נושא: ${params.specificPoints.join(', ')}` : ''}

טון: ${params.tone || 'רשמי'}
אורך: 100-150 מילים
מבנה: כותרת, גוף, קריאה לפעולה`;
  }

  private generateSubject(params: FeedbackParams): string {
    const subjects: Record<string, Record<string, string>> = {
      feedback: {
        default: 'משוב על ביצועים',
        positive: 'משוב חיובי על עבודתך',
        constructive: 'משוב לשיפור',
      },
      review: {
        annual_review: 'הערכת ביצועים שנתית',
        mid_year_review: 'הערכת ביצועים חצי שנתית',
        probation_review: 'סיכום תקופת ניסיון',
        default: 'הערכת ביצועים',
      },
      email: {
        birthday: 'ברכות ליום ההולדת!',
        anniversary: 'ברכות לרגל ותק',
        hiring: 'ברוך הבא לצוות!',
        termination: 'סיום העסקה',
        default: 'הודעה ממשאבי אנוש',
      },
      announcement: {
        default: 'הודעה חשובה',
      },
    };

    const typeSubjects = subjects[params.type || 'email'] || subjects.email;
    return typeSubjects[params.context || 'default'] || typeSubjects.default;
  }

  private formatOutput(params: FeedbackParams, document: GeneratedDocument): string {
    const lines: string[] = [
      '# 📝 מסמך HR',
      '',
      '---',
      '',
      '## פרטים',
      '',
      `**סוג:** ${this.getTypeHebrew(document.type)}`,
    ];

    if (params.employeeName) {
      lines.push(`**עובד:** ${params.employeeName}`);
    }

    lines.push(`**טון:** ${this.getToneHebrew(document.tone)}`);
    lines.push(`**נושא:** ${document.subject}`);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## תוכן');
    lines.push('');
    lines.push('```');
    lines.push(document.content);
    lines.push('```');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('*ניתן להתאים את התוכן לפי הצורך*');

    return lines.join('\n');
  }

  private getTypeHebrew(type: string): string {
    const types: Record<string, string> = {
      feedback: 'משוב',
      review: 'הערכת ביצועים',
      email: 'מייל',
      announcement: 'הודעה',
    };
    return types[type] || type;
  }

  private getToneHebrew(tone: string): string {
    const tones: Record<string, string> = {
      positive: 'חיובי',
      constructive: 'קונסטרוקטיבי',
      formal: 'רשמי',
      professional: 'מקצועי',
    };
    return tones[tone] || tone;
  }
}

interface FeedbackParams {
  type?: 'feedback' | 'review' | 'email' | 'announcement';
  employeeName?: string;
  context?: string;
  tone?: string;
  specificPoints?: string[];
}

interface GeneratedDocument {
  type: string;
  content: string;
  subject: string;
  tone: string;
}
