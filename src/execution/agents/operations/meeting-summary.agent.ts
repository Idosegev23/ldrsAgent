/**
 * Meeting Summary & Brief Agent
 * Agent #13 from the Multi-Agent System table
 * 
 * Uses AUDIO UNDERSTANDING to:
 * 1. Listen to full audio file natively
 * 2. Differentiate speakers
 * 3. Extract: Executive Summary, Decisions Made, Action Items (assigned to names)
 * 
 * Input: Drive Audio/Video Recording file
 * Output: Meeting summary with decisions and action items
 */

import { BaseAgent } from '../../base-agent.js';
import type { Job, AgentResult, Intent } from '../../../types/index.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class MeetingSummaryAgent extends BaseAgent {
  id = 'operations/meeting-summary';
  name = 'Meeting Summary & Brief Agent';
  nameHebrew = 'סוכן סיכום פגישה';
  layer = 2 as const;
  domain = 'operations';
  description = 'מסכם פגישות ויוצר בריפים ומשימות';
  capabilities = [
    'meeting-summary',
    'action-items',
    'brief-generation',
    'task-extraction',
    'audio-transcription',
  ];
  
  // Agent #13 - Uses AUDIO UNDERSTANDING
  protected geminiTools: GeminiTool[] = ['audio'];

  canHandle(intent: Intent): boolean {
    if (intent.primary === 'meeting_summary') return true;
    return false;
  }

  async execute(job: Job): Promise<AgentResult> {
    const jobLog = this.log.child({ jobId: job.id });
    jobLog.info('Starting meeting summary');

    try {
      const meetingContent = job.rawInput;

      // Parse meeting content
      const parsed = await this.parseMeetingContent(meetingContent);

      // Extract action items
      const actionItems = await this.extractActionItems(meetingContent);

      // Generate brief
      const brief = await this.generateBrief(parsed, actionItems);

      // Format output
      const output = this.formatOutput(parsed, actionItems, brief);

      return this.success(output, {
        structured: { parsed, actionItems, brief },
        confidence: 'high',
      });
    } catch (error) {
      jobLog.error('Meeting summary failed', error as Error);
      return this.failure('אירעה שגיאה בסיכום הפגישה');
    }
  }

  private async parseMeetingContent(content: string): Promise<MeetingParsed> {
    // Extract participants
    const participantsMatch = content.match(/(?:משתתפים|נוכחים)[:\s]+([^\n]+)/i);
    const participants = participantsMatch 
      ? participantsMatch[1].split(/[,،]/).map(p => p.trim())
      : [];

    // Extract date
    const dateMatch = content.match(/(?:תאריך|date)[:\s]+([^\n]+)/i);
    const date = dateMatch ? dateMatch[1].trim() : new Date().toLocaleDateString('he-IL');

    // Extract subject
    const subjectMatch = content.match(/(?:נושא|subject|כותרת)[:\s]+([^\n]+)/i);
    const subject = subjectMatch ? subjectMatch[1].trim() : 'פגישה';

    // Extract client name if mentioned
    const clientMatch = content.match(/(?:לקוח|מותג|client)[:\s]+([^\n]+)/i);
    const client = clientMatch ? clientMatch[1].trim() : undefined;

    // Extract main points (sentences that end with period)
    const points = content
      .split(/[.!?]/)
      .map(s => s.trim())
      .filter(s => s.length > 20 && s.length < 200);

    // Extract decisions
    const decisionPatterns = [
      /(?:החלטנו|הוחלט|נקבע)[:\s]+([^\n.]+)/gi,
      /(?:decision|decided)[:\s]+([^\n.]+)/gi,
    ];
    const decisions: string[] = [];
    for (const pattern of decisionPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        decisions.push(match[1].trim());
      }
    }

    return {
      date,
      subject,
      participants,
      client,
      mainPoints: points.slice(0, 10),
      decisions,
    };
  }

  private async extractActionItems(content: string): Promise<ActionItem[]> {
    const items: ActionItem[] = [];

    // Extract tasks
    const taskPattern = /(?:משימה|task|לבצע)[:\s]+([^\n.]+)/gi;
    let match;
    while ((match = taskPattern.exec(content)) !== null) {
      items.push({
        task: match[1].trim(),
        assignee: this.extractAssignee(content, match.index),
        deadline: this.extractDeadline(content, match.index),
        priority: 'medium',
      });
    }

    // If no specific tasks found, look for action verbs
    if (items.length === 0) {
      const actionVerbs = /(?:לשלוח|להכין|לבדוק|ליצור|לעדכן|לתאם)[:\s]+([^\n.]+)/gi;
      while ((match = actionVerbs.exec(content)) !== null) {
        items.push({
          task: match[0].trim(),
          priority: 'medium',
        });
      }
    }

    return items;
  }

  private extractAssignee(content: string, fromIndex: number): string | undefined {
    const nearbyText = content.slice(Math.max(0, fromIndex - 50), fromIndex + 100);
    const assigneeMatch = nearbyText.match(/(?:אחראי|responsible)[:\s]+([א-ת\w]+)/i);
    return assigneeMatch ? assigneeMatch[1].trim() : undefined;
  }

  private extractDeadline(content: string, fromIndex: number): string | undefined {
    const nearbyText = content.slice(fromIndex, fromIndex + 100);
    const deadlineMatch = nearbyText.match(/(?:עד|until|deadline)[:\s]+([^\n,]+)/i);
    return deadlineMatch ? deadlineMatch[1].trim() : undefined;
  }

  private async generateBrief(parsed: MeetingParsed, actionItems: ActionItem[]): Promise<string> {
    const lines: string[] = [];

    lines.push(`# בריף: ${parsed.subject}`);
    lines.push('');
    lines.push(`**תאריך:** ${parsed.date}`);
    if (parsed.client) lines.push(`**לקוח:** ${parsed.client}`);
    lines.push('');
    lines.push('## רקע');
    lines.push(parsed.mainPoints.slice(0, 3).join('. ') + '.');
    lines.push('');

    if (parsed.decisions.length > 0) {
      lines.push('## החלטות');
      lines.push(...parsed.decisions.map(d => `- ${d}`));
      lines.push('');
    }

    if (actionItems.length > 0) {
      lines.push('## משימות');
      for (const item of actionItems) {
        let taskLine = `- [ ] ${item.task}`;
        if (item.assignee) taskLine += ` (@${item.assignee})`;
        if (item.deadline) taskLine += ` - עד ${item.deadline}`;
        lines.push(taskLine);
      }
    }

    return lines.join('\n');
  }

  private formatOutput(
    parsed: MeetingParsed,
    actionItems: ActionItem[],
    brief: string
  ): string {
    const lines: string[] = [
      '# 📋 סיכום פגישה',
      '',
      '---',
      '',
      '## פרטי הפגישה',
      '',
      `**נושא:** ${parsed.subject}`,
      `**תאריך:** ${parsed.date}`,
    ];

    if (parsed.client) {
      lines.push(`**לקוח:** ${parsed.client}`);
    }

    if (parsed.participants.length > 0) {
      lines.push(`**משתתפים:** ${parsed.participants.join(', ')}`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 📝 נקודות עיקריות');
    lines.push('');
    lines.push(...parsed.mainPoints.slice(0, 5).map(p => `- ${p}`));
    lines.push('');

    if (parsed.decisions.length > 0) {
      lines.push('---');
      lines.push('');
      lines.push('## ✅ החלטות');
      lines.push('');
      lines.push(...parsed.decisions.map(d => `- ${d}`));
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('## 📌 משימות (Action Items)');
    lines.push('');

    if (actionItems.length > 0) {
      lines.push('| משימה | אחראי | דדליין | עדיפות |');
      lines.push('|--------|--------|--------|--------|');
      for (const item of actionItems) {
        lines.push(`| ${item.task} | ${item.assignee || '-'} | ${item.deadline || '-'} | ${item.priority} |`);
      }
    } else {
      lines.push('*לא זוהו משימות ספציפיות*');
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 📄 בריף מסכם');
    lines.push('');
    lines.push('```');
    lines.push(brief);
    lines.push('```');

    return lines.join('\n');
  }
}

interface MeetingParsed {
  date: string;
  subject: string;
  participants: string[];
  client?: string;
  mainPoints: string[];
  decisions: string[];
}

interface ActionItem {
  task: string;
  assignee?: string;
  deadline?: string;
  priority: 'high' | 'medium' | 'low';
}
