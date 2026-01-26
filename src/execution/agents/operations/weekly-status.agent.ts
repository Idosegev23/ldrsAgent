/**
 * Org Weekly Status + Reporting Agent
 * Agent #20, #31 from the Multi-Agent System table
 * 
 * Uses LONG CONTEXT to:
 * 1. Summarize weekly activity to one view
 * 2. Show: what happened, what's important, where's risk, where's opportunity
 * 3. Distill and not overwhelm
 * 
 * Input: ClickUp/Drive weekly data dump
 * Output: Clear weekly status with risks and opportunities
 */

import { BaseAgent } from '../../base-agent.js';
import type { Job, AgentResult, Intent } from '../../../types/index.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class WeeklyStatusAgent extends BaseAgent {
  id = 'operations/weekly-status';
  name = 'Weekly Status Agent';
  nameHebrew = 'סוכן סטטוס שבועי';
  layer = 2 as const;
  domain = 'operations';
  description = 'מייצר דוחות סטטוס שבועיים לקמפיינים וצוותים';
  capabilities = [
    'status-reporting',
    'performance-summary',
    'campaign-tracking',
    'team-updates',
  ];
  
  // Agent #20, #31 - Uses LONG CONTEXT
  protected geminiTools: GeminiTool[] = [];

  canHandle(intent: Intent): boolean {
    if (intent.primary === 'weekly_status') return true;
    if (intent.primary === 'media_performance') return true;
    return false;
  }

  async execute(job: Job): Promise<AgentResult> {
    const jobLog = this.log.child({ jobId: job.id });
    jobLog.info('Generating weekly status with real data');

    try {
      const params = this.extractParameters(job.rawInput);
      
      // Try to get client name from intent entities if not found in extraction
      if (!params.clientName && job.intent.entities?.clientName) {
        params.clientName = job.intent.entities.clientName;
        jobLog.info('Got client name from intent entities', { clientName: params.clientName });
      }
      
      // Fetch real data from integrations - search for specific files
      jobLog.info('Fetching data from integrations', { clientName: params.clientName });
      
      let fetchedData;
      if (params.clientName) {
        // Use smart search with clientName - AI will generate variations
        jobLog.info('Starting smart search for client', { clientName: params.clientName });
        
        fetchedData = await this.fetchIntegrationData({
          clientName: params.clientName, // AI-powered smart search
          driveSearch: params.clientName,
          clickupSearch: params.clientName,
        });
        
        if (fetchedData.drive?.files && fetchedData.drive.files.length > 0) {
          jobLog.info('Smart search found files', { 
            clientName: params.clientName,
            count: fetchedData.drive.files.length,
            files: fetchedData.drive.files.slice(0, 3).map(f => f.name),
          });
        } else {
          // Fallback to autoFetch if smart search found nothing
          jobLog.warn('Smart search found no files, trying autoFetch');
          fetchedData = await this.autoFetchData(params.clientName);
        }
      } else {
        jobLog.warn('No client name found, using autoFetch');
        fetchedData = await this.autoFetchData();
      }
      
      // Check knowledge pack for data
      const hasKnowledge = job.knowledgePack.ready && job.knowledgePack.chunks.length > 0;
      const hasFetchedData = 
        (fetchedData.drive?.contents && fetchedData.drive.contents.length > 0) ||
        (fetchedData.clickup?.tasks && fetchedData.clickup.tasks.length > 0);

      jobLog.info('Data status', { 
        hasKnowledge, 
        hasFetchedData,
        driveFiles: fetchedData.drive?.files?.length || 0,
        driveContents: fetchedData.drive?.contents?.length || 0,
        clickupTasks: fetchedData.clickup?.tasks?.length || 0,
      });

      // Build comprehensive context
      let dataContext = '';
      
      if (hasFetchedData && fetchedData.drive?.contents) {
        dataContext += '## נתונים מ-Google Drive:\n\n';
        for (const content of fetchedData.drive.contents) {
          dataContext += `### ${content.fileName}\n${content.content}\n\n`;
        }
      }
      
      if (hasKnowledge) {
        dataContext += '## נתונים נוספים:\n\n';
        for (const chunk of job.knowledgePack.chunks.slice(0, 3)) {
          dataContext += `${chunk.content}\n\n`;
        }
      }

      // Generate report with LLM using real data
      let report: string;
      
      if (dataContext.trim()) {
        jobLog.info('Generating data-driven report with LLM');
        
        const prompt = `אתה מנתח נתונים ומייצר דוחות סטטוס מקצועיים.

## בקשת המשתמש
${job.rawInput}

## נתונים שנמצאו במערכת
${dataContext}

## הנחיות קריטיות
⚠️ **חובה להשתמש רק במספרים שמופיעים בנתונים למעלה!**
⚠️ **אסור לכתוב [להשלים], [X], [Y] או כל placeholder אחר!**
⚠️ **אם אין נתון ספציפי - כתוב "נתון לא זמין" במקום placeholder!**

## תהליך העבודה
1. קרא את כל הנתונים שמופיעים למעלה
2. חלץ מספרים, מדדים וביצועים ממשיים
3. זהה מגמות (עליה/ירידה) בהתבסס על הנתונים בלבד
4. צור דוח מקצועי עם המספרים האמיתיים

## פורמט הפלט
כתוב דוח סטטוס כולל:
- **סיכום ביצועים** - רק עם מספרים שמצאת בנתונים
- **הישגים מרכזיים** - מבוסס על ממצאים אמיתיים
- **אתגרים** - אם זוהו בנתונים
- **המלצות** - מבוססות על הניתוח

אם אין מספיק נתונים - כתוב זאת בפתיחה: "הדוח מבוסס על נתונים חלקיים".
כתוב בעברית, בצורה מקצועית ואנליטית, ללא כל placeholders!`;

        report = await this.callLLM(prompt, 'reasoning');
      } else {
        // No data found - generate template
        jobLog.warn('No data found, generating template');
        report = this.generateTemplateReport(params);
      }

      return this.success(report, {
        structured: { 
          params, 
          hasKnowledge, 
          hasFetchedData,
          dataSourceCount: (fetchedData.drive?.contents?.length || 0) + job.knowledgePack.chunks.length,
        },
        confidence: hasFetchedData ? 'high' : 'medium',
      });
    } catch (error) {
      jobLog.error('Weekly status generation failed', error as Error);
      return this.failure('אירעה שגיאה ביצירת דוח הסטטוס');
    }
  }

  private extractParameters(input: string): StatusParams {
    const params: StatusParams = {};

    // Extract client/campaign name - improved patterns
    const clientPatterns = [
      /(?:על המותג|למותג|מותג)\s+([א-ת\w\s]+?)(?:\s+(?:ו|,|בחודש|ב|ותשלח)|$)/i,
      /(?:של|עבור|ל)\s+([א-ת\w]+)\s+(?:ב|בחודש|החודש)/i,  // של סיקרט בחודש
      /(?:הפעילות|פעילות)\s+(?:של|עבור)\s+([א-ת\w]+)/i,   // הפעילות של סיקרט
      /(?:לקוח|client)[:\s]+([^\n,]+)/i,
      /(?:קמפיין|campaign)[:\s]+([^\n,]+)/i,
    ];
    
    for (const pattern of clientPatterns) {
      const match = input.match(pattern);
      if (match) {
        params.clientName = match[1].trim();
        this.log.info('Matched client name with pattern', { clientName: params.clientName, pattern: pattern.toString() });
        break;
      }
    }
    
    // If still no client name, try intent classifier result from knowledge pack
    if (!params.clientName) {
      this.log.warn('Could not extract client name from input');
    }

    // Extract date range - improved for month detection
    let dateRange = '';
    const months = {
      'ינואר': 'January',
      'פברואר': 'February', 
      'מרץ': 'March',
      'אפריל': 'April',
      'מאי': 'May',
      'יוני': 'June',
      'יולי': 'July',
      'אוגוסט': 'August',
      'ספטמבר': 'September',
      'אוקטובר': 'October',
      'נובמבר': 'November',
      'דצמבר': 'December',
    };
    
    for (const [hebrew, english] of Object.entries(months)) {
      if (input.toLowerCase().includes(hebrew.toLowerCase())) {
        dateRange = `חודש ${hebrew}`;
        break;
      }
    }
    
    if (!dateRange) {
      const dateMatch = input.match(/(?:שבוע|week|תאריך|חודש)[:\s]+([^\n]+)/i);
      if (dateMatch) dateRange = dateMatch[1].trim();
    }
    
    params.dateRange = dateRange || 'השבוע האחרון';

    // Extract report type
    if (input.includes('מדיה') || input.includes('media')) params.reportType = 'media';
    else if (input.includes('משפיענים') || input.includes('influencer')) params.reportType = 'influencer';
    else if (input.includes('צוות') || input.includes('team')) params.reportType = 'team';
    else params.reportType = 'general';

    this.log.info('Extracted parameters from input', { 
      clientName: params.clientName,
      dateRange: params.dateRange,
      reportType: params.reportType,
    });

    return params;
  }

  private async generateDataDrivenReport(job: Job, params: StatusParams): Promise<string> {
    const lines: string[] = [
      `# 📊 דוח סטטוס שבועי`,
      '',
    ];

    if (params.clientName) {
      lines.push(`**לקוח/קמפיין:** ${params.clientName}`);
    }
    lines.push(`**תקופה:** ${params.dateRange || 'השבוע האחרון'}`);
    lines.push(`**סוג דוח:** ${this.getReportTypeName(params.reportType)}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Extract data from knowledge pack
    lines.push('## 📈 ביצועים');
    lines.push('');
    lines.push('*נתונים מבוססים על המידע שנמצא במערכת:*');
    lines.push('');

    for (const chunk of job.knowledgePack.chunks.slice(0, 5)) {
      lines.push(`- ${chunk.content.slice(0, 150)}...`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 🎯 המלצות');
    lines.push('');
    lines.push('- המשך מעקב אחר ביצועים');
    lines.push('- אופטימיזציה על בסיס הנתונים');
    lines.push('- עדכון בפגישה הבאה');

    return lines.join('\n');
  }

  private generateTemplateReport(params: StatusParams): string {
    const clientName = params.clientName || 'הלקוח';
    const period = params.dateRange || 'השבוע האחרון';
    
    const lines: string[] = [
      `# ⚠️ לא נמצאו נתונים`,
      '',
      `**לקוח:** ${clientName}`,
      `**תקופה:** ${period}`,
      '',
      '---',
      '',
      '## מה קרה?',
      '',
      `לא הצלחתי למצוא נתוני ביצועים עבור ${clientName} בתקופה המבוקשת.`,
      '',
      '## סיבות אפשריות:',
      '',
      `1. אין קובץ "טבלת שליטה" או קובץ נתונים עבור ${clientName} ב-Google Drive`,
      '2. הקובץ לא שותף עם המערכת',
      '3. שם הלקוח שונה ממה שמופיע בקבצים',
      '',
      '## מה אפשר לעשות?',
      '',
      '1. **וודא שיש קובץ נתונים** - בדוק ש-Google Drive מכיל קובץ עם נתוני הלקוח',
      `2. **שתף את הקובץ** - ודא שהקובץ משותף עם service account של המערכת`,
      `3. **נסה שוב עם שם מדויק** - השתמש בשם הלקוח בדיוק כפי שמופיע בקובץ`,
      '',
      '---',
      '',
      '**טיפ:** אם יש לך קובץ נתונים, אפשר להעלות אותו ישירות או לשתף את הקישור.',
    ];

    return lines.join('\n');
  }

  private getReportTypeName(type?: string): string {
    const names: Record<string, string> = {
      media: 'מדיה וקמפיינים',
      influencer: 'משפיענים',
      team: 'צוות',
      general: 'כללי',
    };
    return names[type || 'general'];
  }
}

interface StatusParams {
  clientName?: string;
  dateRange?: string;
  reportType?: 'media' | 'influencer' | 'team' | 'general';
}
