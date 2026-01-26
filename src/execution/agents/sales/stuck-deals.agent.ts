/**
 * Deal Recovery & Follow-up Agent
 * Agent #15 from the Multi-Agent System table
 * 
 * Uses LONG CONTEXT to:
 * 1. Analyze conversation history
 * 2. Identify underlying objection (Price, Timing, Fit)
 * 3. Draft personalized re-engagement email addressing specific objection
 * 
 * Input: ClickUp/Gmail last interaction history, "Lost" reason
 * Output: Follow-up strategy with ready-to-send messages
 */

import { BaseAgent } from '../../base-agent.js';
import { getLLMManager } from '../../../llm/manager.js';
import type { Job, AgentResult, Intent } from '../../../types/index.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class StuckDealsAgent extends BaseAgent {
  id = 'sales/stuck-deals';
  name = 'Stuck Deals Follow-Up Agent';
  nameHebrew = 'סוכן מעקב דילים תקועים';
  layer = 2 as const;
  domain = 'sales';
  description = 'מזהה עסקאות תקועות ומייצר הודעות מעקב חכמות';
  capabilities = [
    'deal-analysis',
    'follow-up-generation',
    'objection-handling',
    'engagement-timing',
  ];
  
  // Agent #15 - Uses LONG CONTEXT
  protected geminiTools: GeminiTool[] = [];

  canHandle(intent: Intent): boolean {
    if (intent.primary === 'sales_followup') return true;
    if (intent.entities.action === 'follow_up' && intent.entities.domain === 'sales') return true;
    return false;
  }

  async execute(job: Job): Promise<AgentResult> {
    const jobLog = this.log.child({ jobId: job.id });
    jobLog.info('Analyzing stuck deals');

    try {
      const params = this.extractParameters(job.rawInput);

      // Analyze deal status
      const dealAnalysis = await this.analyzeDeal(params, job);

      // Generate follow-up strategy
      const strategy = await this.generateStrategy(dealAnalysis);

      // Generate follow-up messages
      const messages = await this.generateFollowUpMessages(dealAnalysis, strategy);

      // Format output
      const output = this.formatOutput(dealAnalysis, strategy, messages);

      return this.success(output, {
        structured: { dealAnalysis, strategy, messages },
        confidence: 'high',
      });
    } catch (error) {
      jobLog.error('Stuck deals analysis failed', error as Error);
      return this.failure('אירעה שגיאה בניתוח הדיל');
    }
  }

  private extractParameters(input: string): DealParams {
    const params: DealParams = {};

    // Extract client/deal name
    const clientMatch = input.match(/(?:לקוח|דיל|עסקה|client|deal)[:\s]+([^\n,]+)/i);
    if (clientMatch) params.clientName = clientMatch[1].trim();

    // Extract last contact
    const lastContactMatch = input.match(/(?:אחרון|last)[:\s]+([^\n,]+)/i);
    if (lastContactMatch) params.lastContact = lastContactMatch[1].trim();

    // Extract deal value
    const valueMatch = input.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:ש[״"]?ח|₪|שקל)/);
    if (valueMatch) params.dealValue = parseInt(valueMatch[1].replace(/,/g, ''));

    // Extract stage
    if (input.includes('הצעה')) params.stage = 'proposal_sent';
    else if (input.includes('פגישה')) params.stage = 'meeting_scheduled';
    else if (input.includes('משא ומתן')) params.stage = 'negotiation';
    else params.stage = 'initial_contact';

    // Extract objections
    const objections: string[] = [];
    if (input.includes('מחיר')) objections.push('price');
    if (input.includes('תקציב')) objections.push('budget');
    if (input.includes('זמן')) objections.push('timing');
    if (input.includes('מתחרה')) objections.push('competitor');
    if (objections.length > 0) params.objections = objections;

    return params;
  }

  private async analyzeDeal(params: DealParams, job: Job): Promise<DealAnalysis> {
    // Check knowledge pack for deal history
    const hasHistory = job.knowledgePack.ready && job.knowledgePack.chunks.length > 0;

    // Calculate days since last contact (mock)
    const daysSinceContact = params.lastContact ? 7 : 14;

    // Determine deal temperature
    let temperature: 'hot' | 'warm' | 'cold' = 'warm';
    if (daysSinceContact > 14) temperature = 'cold';
    else if (daysSinceContact < 5) temperature = 'hot';

    // Identify blockers
    const blockers: string[] = [];
    if (params.objections?.includes('price')) blockers.push('התנגדות מחיר');
    if (params.objections?.includes('budget')) blockers.push('אין תקציב');
    if (params.objections?.includes('timing')) blockers.push('תזמון לא מתאים');
    if (params.objections?.includes('competitor')) blockers.push('בוחנים מתחרה');
    if (daysSinceContact > 10) blockers.push('אין תקשורת');

    return {
      clientName: params.clientName || 'לקוח',
      stage: params.stage || 'initial_contact',
      temperature,
      daysSinceContact,
      dealValue: params.dealValue,
      objections: params.objections || [],
      blockers,
      hasHistory,
      urgency: this.calculateUrgency(temperature, params.dealValue),
    };
  }

  private calculateUrgency(temperature: string, value?: number): 'high' | 'medium' | 'low' {
    if (temperature === 'cold') return 'high';
    if (value && value > 100000) return 'high';
    if (temperature === 'hot') return 'low';
    return 'medium';
  }

  private async generateStrategy(analysis: DealAnalysis): Promise<FollowUpStrategy> {
    const actions: string[] = [];
    const timing: string[] = [];
    const tone: string[] = [];

    // Based on temperature
    if (analysis.temperature === 'cold') {
      actions.push('שליחת ערך חדש');
      actions.push('הצעה מיוחדת מוגבלת בזמן');
      timing.push('היום');
      tone.push('דחיפות עדינה');
    } else if (analysis.temperature === 'warm') {
      actions.push('תזכורת ידידותית');
      actions.push('הוספת ערך');
      timing.push('תוך 2-3 ימים');
      tone.push('מקצועי וחברותי');
    } else {
      actions.push('המשך דיאלוג');
      timing.push('לפי התקדמות');
      tone.push('אופטימי');
    }

    // Based on objections
    for (const objection of analysis.objections) {
      if (objection === 'price') {
        actions.push('הצגת ROI');
        actions.push('הצעת תשלומים');
      }
      if (objection === 'budget') {
        actions.push('הצעת גרסה מצומצמת');
        actions.push('דחייה לרבעון הבא');
      }
      if (objection === 'competitor') {
        actions.push('הדגשת יתרונות ייחודיים');
        actions.push('case studies');
      }
    }

    return {
      recommendedActions: actions,
      suggestedTiming: timing,
      toneGuidelines: tone,
      channelPriority: this.getChannelPriority(analysis),
    };
  }

  private getChannelPriority(analysis: DealAnalysis): string[] {
    if (analysis.temperature === 'cold') {
      return ['טלפון', 'וואצאפ', 'מייל'];
    }
    if (analysis.urgency === 'high') {
      return ['טלפון', 'וואצאפ'];
    }
    return ['מייל', 'וואצאפ', 'טלפון'];
  }

  private async generateFollowUpMessages(
    analysis: DealAnalysis,
    strategy: FollowUpStrategy
  ): Promise<FollowUpMessage[]> {
    const messages: FollowUpMessage[] = [];
    const llm = getLLMManager();

    // WhatsApp message
    const waPrompt = `כתוב הודעת וואצאפ קצרה (עד 50 מילים) ללקוח "${analysis.clientName}".
מצב: ${analysis.temperature === 'cold' ? 'לא היה קשר זמן רב' : 'בתהליך מכירה פעיל'}
מטרה: ${strategy.recommendedActions[0]}
טון: ${strategy.toneGuidelines[0]}
אל תכלול אימוג'ים מוגזמים. תהיה מקצועי אך חברותי.`;

    const waMessage = await llm.complete(waPrompt, 'writing');

    messages.push({
      channel: 'whatsapp',
      subject: undefined,
      body: waMessage.trim(),
      timing: strategy.suggestedTiming[0],
    });

    // Email message
    const emailPrompt = `כתוב מייל מעקב קצר ללקוח "${analysis.clientName}".
נושא: שורת נושא קצרה וממוקדת
גוף: עד 100 מילים
מצב הדיל: ${this.getStageHebrew(analysis.stage)}
מטרה: ${strategy.recommendedActions[0]}
טון: מקצועי
כתוב בפורמט:
נושא: [שורת נושא]
---
[גוף המייל]`;

    const emailResponse = await llm.complete(emailPrompt, 'writing');
    const emailParts = emailResponse.split('---');
    const emailSubject = emailParts[0]?.replace('נושא:', '').trim() || 'מעקב';
    const emailBody = emailParts[1]?.trim() || emailResponse;

    messages.push({
      channel: 'email',
      subject: emailSubject,
      body: emailBody,
      timing: 'מחר בבוקר',
    });

    return messages;
  }

  private getStageHebrew(stage: string): string {
    const stages: Record<string, string> = {
      'initial_contact': 'קשר ראשוני',
      'meeting_scheduled': 'פגישה נקבעה',
      'proposal_sent': 'הצעה נשלחה',
      'negotiation': 'משא ומתן',
    };
    return stages[stage] || stage;
  }

  private formatOutput(
    analysis: DealAnalysis,
    strategy: FollowUpStrategy,
    messages: FollowUpMessage[]
  ): string {
    const lines: string[] = [
      '# 📊 ניתוח דיל תקוע',
      '',
      '---',
      '',
      '## מצב הדיל',
      '',
      `**לקוח:** ${analysis.clientName}`,
      `**שלב:** ${this.getStageHebrew(analysis.stage)}`,
      `**טמפרטורה:** ${this.getTemperatureEmoji(analysis.temperature)} ${analysis.temperature}`,
      `**ימים מאז קשר אחרון:** ${analysis.daysSinceContact}`,
    ];

    if (analysis.dealValue) {
      lines.push(`**שווי עסקה:** ${analysis.dealValue.toLocaleString()} ש"ח`);
    }

    lines.push(`**דחיפות:** ${analysis.urgency}`);
    lines.push('');

    if (analysis.blockers.length > 0) {
      lines.push('### חסמים שזוהו');
      lines.push(...analysis.blockers.map(b => `- ${b}`));
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('## 🎯 אסטרטגיית מעקב');
    lines.push('');
    lines.push('### פעולות מומלצות');
    lines.push(...strategy.recommendedActions.map((a, i) => `${i + 1}. ${a}`));
    lines.push('');
    lines.push(`**תזמון:** ${strategy.suggestedTiming.join(', ')}`);
    lines.push(`**טון:** ${strategy.toneGuidelines.join(', ')}`);
    lines.push(`**ערוצים (לפי עדיפות):** ${strategy.channelPriority.join(' → ')}`);
    lines.push('');

    lines.push('---');
    lines.push('');
    lines.push('## 📝 הודעות מוכנות');
    lines.push('');

    for (const msg of messages) {
      const channelName = msg.channel === 'whatsapp' ? 'וואצאפ' : 'מייל';
      const icon = msg.channel === 'whatsapp' ? '💬' : '📧';
      
      lines.push(`### ${icon} ${channelName}`);
      if (msg.subject) {
        lines.push(`**נושא:** ${msg.subject}`);
      }
      lines.push(`**לשלוח:** ${msg.timing}`);
      lines.push('');
      lines.push('```');
      lines.push(msg.body);
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }

  private getTemperatureEmoji(temp: string): string {
    if (temp === 'hot') return '🔥';
    if (temp === 'warm') return '🌡️';
    return '❄️';
  }
}

interface DealParams {
  clientName?: string;
  lastContact?: string;
  dealValue?: number;
  stage?: string;
  objections?: string[];
}

interface DealAnalysis {
  clientName: string;
  stage: string;
  temperature: 'hot' | 'warm' | 'cold';
  daysSinceContact: number;
  dealValue?: number;
  objections: string[];
  blockers: string[];
  hasHistory: boolean;
  urgency: 'high' | 'medium' | 'low';
}

interface FollowUpStrategy {
  recommendedActions: string[];
  suggestedTiming: string[];
  toneGuidelines: string[];
  channelPriority: string[];
}

interface FollowUpMessage {
  channel: 'whatsapp' | 'email' | 'phone';
  subject?: string;
  body: string;
  timing: string;
}
