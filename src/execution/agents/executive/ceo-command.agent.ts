/**
 * CEO Command Agent
 * Agent #30 from the Multi-Agent System table
 * 
 * Uses LONG CONTEXT to:
 * 1. Filter out 90% of the noise from daily dump
 * 2. Identify only: Red Flags (High priority tasks overdue),
 *    Strategic Opportunities, Critical decisions waiting for CEO approval
 * 3. Summarize into 3-bullet briefing
 * 
 * Input: Gmail/Calendar/ClickUp daily dump of unread items
 * Output: 3-bullet executive briefing
 */

import { BaseAgent } from '../../base-agent.js';
import type { Job, AgentResult, Intent } from '../../../types/index.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class CEOCommandAgent extends BaseAgent {
  id = 'executive/ceo-command';
  name = 'CEO Command Agent';
  nameHebrew = 'סוכן מנכ"ל';
  layer = 2 as const;
  domain = 'executive';
  description = 'מנהל יומן, משימות וביצועים למנכ"ל';
  capabilities = [
    'calendar-management',
    'task-prioritization',
    'performance-dashboard',
    'executive-summary',
    'daily-briefing',
  ];
  
  // Agent #30 - Uses LONG CONTEXT (no special tools, just large context)
  protected geminiTools: GeminiTool[] = [];

  canHandle(intent: Intent): boolean {
    if (intent.primary === 'calendar_query') return true;
    if (intent.primary === 'calendar_create') return true;
    if (intent.entities.domain === 'executive') return true;
    return false;
  }

  async execute(job: Job): Promise<AgentResult> {
    const jobLog = this.log.child({ jobId: job.id });
    jobLog.info('Processing CEO command');

    try {
      const commandType = this.detectCommandType(job.rawInput);

      let result: CommandResult;

      switch (commandType) {
        case 'daily_brief':
          result = await this.generateDailyBrief(job);
          break;
        case 'task_review':
          result = await this.reviewTasks(job);
          break;
        case 'performance_check':
          result = await this.checkPerformance(job);
          break;
        case 'schedule_check':
          result = await this.checkSchedule(job);
          break;
        default:
          result = await this.generateExecutiveSummary(job);
      }

      return this.success(result.output, {
        structured: result.data,
        confidence: 'high',
      });
    } catch (error) {
      jobLog.error('CEO command failed', error as Error);
      return this.failure('אירעה שגיאה בביצוע הפקודה');
    }
  }

  private detectCommandType(input: string): string {
    const lower = input.toLowerCase();
    
    if (lower.includes('יום') || lower.includes('בוקר') || lower.includes('סיכום')) {
      return 'daily_brief';
    }
    if (lower.includes('משימ') || lower.includes('task')) {
      return 'task_review';
    }
    if (lower.includes('ביצוע') || lower.includes('performance') || lower.includes('kpi')) {
      return 'performance_check';
    }
    if (lower.includes('יומן') || lower.includes('לו"ז') || lower.includes('פגישות')) {
      return 'schedule_check';
    }
    
    return 'executive_summary';
  }

  private async generateDailyBrief(_job: Job): Promise<CommandResult> {
    const today = new Date();
    const dayName = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][today.getDay()];
    const dateStr = today.toLocaleDateString('he-IL');

    // Mock data - in production would pull from integrations
    const brief: DailyBrief = {
      date: dateStr,
      dayName,
      topPriorities: [
        { task: 'סגירת דיל עם לקוח X', priority: 'critical', deadline: 'היום' },
        { task: 'אישור הצעת מחיר Y', priority: 'high', deadline: 'היום' },
        { task: 'שיחה עם שותף אסטרטגי', priority: 'high', deadline: 'השבוע' },
      ],
      meetings: [
        { time: '09:00', title: 'צוות מנהלים', duration: '1 שעה' },
        { time: '11:00', title: 'שיחת לקוח', duration: '30 דקות' },
        { time: '14:00', title: 'סקירה שבועית', duration: '2 שעות' },
      ],
      alerts: [
        { type: 'warning', message: 'דיל תקוע מעל שבועיים' },
        { type: 'info', message: 'יום הולדת לעובד היום' },
      ],
      metrics: {
        openDeals: 12,
        dealValue: 500000,
        teamCapacity: 85,
        pendingApprovals: 3,
      },
    };

    const output = this.formatDailyBrief(brief);

    return { output, data: brief as unknown as Record<string, unknown> };
  }

  private formatDailyBrief(brief: DailyBrief): string {
    const lines: string[] = [
      `# 📋 בריף יומי - יום ${brief.dayName}`,
      `*${brief.date}*`,
      '',
      '---',
      '',
    ];

    // Alerts
    if (brief.alerts.length > 0) {
      lines.push('## 🔔 התראות');
      for (const alert of brief.alerts) {
        const icon = alert.type === 'warning' ? '⚠️' : alert.type === 'critical' ? '🚨' : 'ℹ️';
        lines.push(`${icon} ${alert.message}`);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    // Top priorities
    lines.push('## 🎯 עדיפויות היום');
    lines.push('');
    for (let i = 0; i < brief.topPriorities.length; i++) {
      const p = brief.topPriorities[i];
      const priorityIcon = p.priority === 'critical' ? '🔴' : p.priority === 'high' ? '🟠' : '🟡';
      lines.push(`${i + 1}. ${priorityIcon} **${p.task}** (${p.deadline})`);
    }
    lines.push('');

    // Schedule
    lines.push('---');
    lines.push('');
    lines.push('## 📅 לו"ז היום');
    lines.push('');
    for (const meeting of brief.meetings) {
      lines.push(`- **${meeting.time}** - ${meeting.title} (${meeting.duration})`);
    }
    lines.push('');

    // Quick metrics
    lines.push('---');
    lines.push('');
    lines.push('## 📊 מדדים מהירים');
    lines.push('');
    lines.push(`| מדד | ערך |`);
    lines.push(`|-----|-----|`);
    lines.push(`| דילים פתוחים | ${brief.metrics.openDeals} |`);
    lines.push(`| שווי דילים | ${brief.metrics.dealValue.toLocaleString()} ש"ח |`);
    lines.push(`| קיבולת צוות | ${brief.metrics.teamCapacity}% |`);
    lines.push(`| ממתין לאישור | ${brief.metrics.pendingApprovals} |`);

    return lines.join('\n');
  }

  private async reviewTasks(_job: Job): Promise<CommandResult> {
    // Mock task data
    const tasks: Task[] = [
      { id: '1', title: 'אישור הצעה ABC', status: 'pending', priority: 'high', assignee: 'צוות מכירות', dueDate: 'היום' },
      { id: '2', title: 'סקירת דוח רבעוני', status: 'in_progress', priority: 'high', assignee: 'כספים', dueDate: 'מחר' },
      { id: '3', title: 'פגישת אסטרטגיה', status: 'pending', priority: 'medium', assignee: 'הנהלה', dueDate: 'השבוע' },
      { id: '4', title: 'גיוס ראש צוות', status: 'in_progress', priority: 'medium', assignee: 'HR', dueDate: 'החודש' },
    ];

    const grouped = {
      critical: tasks.filter(t => t.priority === 'critical'),
      high: tasks.filter(t => t.priority === 'high'),
      medium: tasks.filter(t => t.priority === 'medium'),
      low: tasks.filter(t => t.priority === 'low'),
    };

    const lines: string[] = [
      '# 📝 סקירת משימות',
      '',
      '---',
      '',
    ];

    for (const [priority, items] of Object.entries(grouped)) {
      if (items.length === 0) continue;
      
      const priorityName = this.getPriorityHebrew(priority);
      const icon = priority === 'critical' ? '🔴' : priority === 'high' ? '🟠' : priority === 'medium' ? '🟡' : '🟢';
      
      lines.push(`## ${icon} ${priorityName}`);
      lines.push('');
      
      for (const task of items) {
        const statusIcon = task.status === 'pending' ? '⏳' : task.status === 'in_progress' ? '🔄' : '✅';
        lines.push(`- ${statusIcon} **${task.title}**`);
        lines.push(`  - אחראי: ${task.assignee}`);
        lines.push(`  - דדליין: ${task.dueDate}`);
      }
      lines.push('');
    }

    // Summary
    lines.push('---');
    lines.push('');
    lines.push(`**סה"כ משימות:** ${tasks.length}`);
    lines.push(`**ממתינות:** ${tasks.filter(t => t.status === 'pending').length}`);
    lines.push(`**בתהליך:** ${tasks.filter(t => t.status === 'in_progress').length}`);

    return { output: lines.join('\n'), data: { tasks, grouped } };
  }

  private async checkPerformance(_job: Job): Promise<CommandResult> {
    // Mock performance data
    const performance: PerformanceData = {
      period: 'החודש',
      revenue: {
        actual: 450000,
        target: 500000,
        percentage: 90,
      },
      deals: {
        closed: 8,
        target: 10,
        pipeline: 15,
        pipelineValue: 750000,
      },
      team: {
        productivity: 85,
        satisfaction: 7.5,
        turnover: 2,
      },
      campaigns: {
        active: 5,
        performance: 'good',
        topCampaign: 'קמפיין X',
      },
    };

    const lines: string[] = [
      '# 📈 דשבורד ביצועים',
      `*${performance.period}*`,
      '',
      '---',
      '',
      '## 💰 הכנסות',
      '',
      `**בפועל:** ${performance.revenue.actual.toLocaleString()} ש"ח`,
      `**יעד:** ${performance.revenue.target.toLocaleString()} ש"ח`,
      `**עמידה:** ${performance.revenue.percentage}%`,
      '',
      this.getProgressBar(performance.revenue.percentage),
      '',
      '---',
      '',
      '## 🤝 דילים',
      '',
      `| מדד | ערך |`,
      `|-----|-----|`,
      `| נסגרו | ${performance.deals.closed}/${performance.deals.target} |`,
      `| בצנרת | ${performance.deals.pipeline} |`,
      `| שווי צנרת | ${performance.deals.pipelineValue.toLocaleString()} ש"ח |`,
      '',
      '---',
      '',
      '## 👥 צוות',
      '',
      `- פרודוקטיביות: ${performance.team.productivity}%`,
      `- שביעות רצון: ${performance.team.satisfaction}/10`,
      `- עזיבות: ${performance.team.turnover}`,
      '',
      '---',
      '',
      '## 📣 קמפיינים',
      '',
      `- פעילים: ${performance.campaigns.active}`,
      `- ביצועים: ${this.getPerformanceHebrew(performance.campaigns.performance)}`,
      `- מוביל: ${performance.campaigns.topCampaign}`,
    ];

    return { output: lines.join('\n'), data: performance as unknown as Record<string, unknown> };
  }

  private async checkSchedule(_job: Job): Promise<CommandResult> {
    // Mock schedule data
    const today = new Date();
    const schedule: ScheduleDay[] = [];

    for (let i = 0; i < 5; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      
      schedule.push({
        date: date.toLocaleDateString('he-IL'),
        dayName: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][date.getDay()],
        meetings: this.generateMockMeetings(i),
        freeSlots: Math.floor(Math.random() * 3) + 1,
      });
    }

    const lines: string[] = [
      '# 📅 סקירת יומן',
      '',
      '---',
      '',
    ];

    for (const day of schedule) {
      lines.push(`## יום ${day.dayName} (${day.date})`);
      lines.push('');
      
      if (day.meetings.length === 0) {
        lines.push('*אין פגישות*');
      } else {
        for (const meeting of day.meetings) {
          lines.push(`- **${meeting.time}** ${meeting.title} (${meeting.duration})`);
        }
      }
      
      lines.push(`*${day.freeSlots} חלונות פנויים*`);
      lines.push('');
    }

    return { output: lines.join('\n'), data: { schedule } };
  }

  private generateMockMeetings(dayOffset: number): Meeting[] {
    if (dayOffset === 0) {
      return [
        { time: '09:00', title: 'צוות מנהלים', duration: '1 שעה' },
        { time: '11:00', title: 'שיחת לקוח', duration: '30 דקות' },
        { time: '14:00', title: 'סקירה שבועית', duration: '2 שעות' },
      ];
    }
    
    const meetingCount = Math.floor(Math.random() * 4) + 1;
    const meetings: Meeting[] = [];
    const times = ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00'];
    const titles = ['פגישת צוות', 'שיחת לקוח', 'סקירת פרויקט', 'תכנון אסטרטגי'];
    
    for (let i = 0; i < meetingCount; i++) {
      meetings.push({
        time: times[i % times.length],
        title: titles[i % titles.length],
        duration: Math.random() > 0.5 ? '1 שעה' : '30 דקות',
      });
    }
    
    return meetings.sort((a, b) => a.time.localeCompare(b.time));
  }

  private async generateExecutiveSummary(_job: Job): Promise<CommandResult> {
    const lines: string[] = [
      '# 📊 סיכום מנכ"ל',
      '',
      '---',
      '',
      '## מה אתה רוצה לדעת?',
      '',
      'אפשרויות:',
      '- **"בריף יומי"** - סיכום היום, פגישות ומשימות',
      '- **"משימות"** - סקירת משימות פתוחות',
      '- **"ביצועים"** - דשבורד KPIs',
      '- **"יומן"** - סקירת לו"ז השבוע',
      '',
      'פשוט כתוב מה מעניין אותך.',
    ];

    return { output: lines.join('\n'), data: {} };
  }

  private getProgressBar(percentage: number): string {
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage}%`;
  }

  private getPriorityHebrew(priority: string): string {
    const priorities: Record<string, string> = {
      critical: 'קריטי',
      high: 'גבוה',
      medium: 'בינוני',
      low: 'נמוך',
    };
    return priorities[priority] || priority;
  }

  private getPerformanceHebrew(perf: string): string {
    const perfs: Record<string, string> = {
      excellent: 'מצוין',
      good: 'טוב',
      average: 'ממוצע',
      poor: 'חלש',
    };
    return perfs[perf] || perf;
  }
}

interface CommandResult {
  output: string;
  data: Record<string, unknown>;
}

interface DailyBrief {
  date: string;
  dayName: string;
  topPriorities: { task: string; priority: string; deadline: string }[];
  meetings: Meeting[];
  alerts: { type: string; message: string }[];
  metrics: {
    openDeals: number;
    dealValue: number;
    teamCapacity: number;
    pendingApprovals: number;
  };
}

interface Meeting {
  time: string;
  title: string;
  duration: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee: string;
  dueDate: string;
}

interface PerformanceData {
  period: string;
  revenue: { actual: number; target: number; percentage: number };
  deals: { closed: number; target: number; pipeline: number; pipelineValue: number };
  team: { productivity: number; satisfaction: number; turnover: number };
  campaigns: { active: number; performance: string; topCampaign: string };
}

interface ScheduleDay {
  date: string;
  dayName: string;
  meetings: Meeting[];
  freeSlots: number;
}
