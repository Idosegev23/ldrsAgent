/**
 * Real Execution Agent
 * Performs full end-to-end executions with real API calls:
 * - Drive search and file reading
 * - AI analysis with Gemini
 * - Calendar event creation
 * - Document upload to Drive
 * 
 * Uses OAuth tokens for per-user API access
 */

import { GoogleGenAI } from '@google/genai';
import * as drive from '../../integrations/connectors/drive.connector.js';
import * as calendar from '../../integrations/connectors/calendar.connector.js';
import { logger } from '../../utils/logger.js';
import type { ExecutionContext } from '../../types/execution.types.js';

const log = logger.child({ component: 'RealExecutionAgent' });

export interface RealExecutionParams {
  userId: string;
  request: string;
  executionId: string;
  context?: ExecutionContext;
}

export interface RealExecutionResult {
  filesFound: number;
  filesAnalyzed: string[];
  analysis: {
    summary: string;
    ppcInsights: string[];
    recommendations: string[];
  };
  calendarEvent?: {
    id: string;
    title: string;
    htmlLink?: string;
  };
  document?: {
    id: string;
    name: string;
    webViewLink?: string;
  };
  error?: string;
}

export class RealExecutionAgent {
  private gemini: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }
    this.gemini = new GoogleGenAI({ apiKey });
  }

  /**
   * Execute full workflow: search -> analyze -> schedule -> document
   */
  async execute(params: RealExecutionParams): Promise<RealExecutionResult> {
    const { userId, request, executionId } = params;

    log.info('Starting real execution', { userId, executionId, request: request.substring(0, 100) });

    const result: RealExecutionResult = {
      filesFound: 0,
      filesAnalyzed: [],
      analysis: {
        summary: '',
        ppcInsights: [],
        recommendations: []
      }
    };

    try {
      // Step 1: Search Drive
      log.info('Step 1: Searching Drive', { userId });
      const searchQuery = this.extractSearchQuery(request);
      const files = await drive.searchFiles(searchQuery, undefined, userId);
      
      result.filesFound = files.length;
      log.info('Files found', { count: files.length });

      if (files.length === 0) {
        result.error = 'לא נמצאו קבצים רלוונטיים';
        return result;
      }

      // Step 2: Read and analyze files
      log.info('Step 2: Reading files', { count: Math.min(3, files.length) });
      let analyzedContent = '';
      
      for (const file of files.slice(0, 3)) {
        try {
          const content = await drive.getFileContent(file.id, userId);
          analyzedContent += content.substring(0, 1000) + '\n\n';
          result.filesAnalyzed.push(file.name);
          log.info('File read successfully', { fileName: file.name, contentLength: content.length });
        } catch (error: any) {
          log.warn('Failed to read file', { fileName: file.name, error: error.message });
        }
      }

      // Step 3: AI Analysis
      if (analyzedContent.length > 50) {
        log.info('Step 3: AI Analysis');
        const analysis = await this.analyzeWithAI(request, files, analyzedContent, result.filesAnalyzed);
        result.analysis = analysis;
      } else {
        result.analysis = {
          summary: `נמצאו ${files.length} קבצים`,
          ppcInsights: [`נמצאו ${files.length} קבצים רלוונטיים`, 'לא הצלחנו לקרוא תוכן מהקבצים'],
          recommendations: ['לבדוק הרשאות גישה לקבצים', 'להשתמש ב-Export API עבור Google Docs']
        };
      }

      // Step 4: Create Calendar Event
      const shouldCreateEvent = this.shouldCreateCalendarEvent(request);
      if (shouldCreateEvent) {
        try {
          log.info('Step 4: Creating calendar event', { userId });
          const eventDetails = this.prepareEventDetails(request, result.analysis, files);
          const event = await calendar.createEvent(eventDetails, userId);
          
          result.calendarEvent = {
            id: event.id,
            title: event.title,
            htmlLink: event.htmlLink
          };
          log.info('Calendar event created', { eventId: event.id });
        } catch (error: any) {
          log.error('Failed to create calendar event', error as Error, { userId });
          result.error = `יצירת פגישה נכשלה: ${error.message}`;
        }
      }

      // Step 5: Create Document
      const shouldCreateDoc = this.shouldCreateDocument(request);
      if (shouldCreateDoc) {
        try {
          log.info('Step 5: Creating document', { userId });
          const docContent = this.prepareDocumentContent(request, result.analysis, files);
          const buffer = Buffer.from(docContent, 'utf-8');
          
          const uploadedFile = await drive.uploadFile({
            fileName: `אג׳נדה - ${new Date().toLocaleDateString('he-IL').replace(/\//g, '-')}.txt`,
            buffer,
            mimeType: 'text/plain',
            userId
          });

          result.document = {
            id: uploadedFile.id,
            name: uploadedFile.name,
            webViewLink: uploadedFile.webViewLink
          };
          log.info('Document created', { fileId: uploadedFile.id });
        } catch (error: any) {
          log.error('Failed to create document', error as Error, { userId });
          result.error = `יצירת מסמך נכשלה: ${error.message}`;
        }
      }

      log.info('Real execution completed', { executionId, filesFound: result.filesFound });
      return result;

    } catch (error: any) {
      log.error('Real execution failed', error as Error, { executionId, userId });
      result.error = error.message;
      return result;
    }
  }

  /**
   * Extract search query from user request
   */
  private extractSearchQuery(request: string): string {
    // Look for client/brand names in the request
    const patterns = [
      /נתונים של (.+?) מחודש/i,
      /(.+?) מחודש/i,
      /נתוני (.+)/i,
      /של (.+)/i
    ];

    for (const pattern of patterns) {
      const match = request.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    // Fallback: use first few words
    return request.split(' ').slice(0, 3).join(' ');
  }

  /**
   * Analyze content with Gemini AI
   */
  private async analyzeWithAI(
    request: string,
    files: any[],
    analyzedContent: string,
    filesAnalyzed: string[]
  ): Promise<{ summary: string; ppcInsights: string[]; recommendations: string[] }> {
    const prompt = `
אתה אנליסט PPC מומחה. הבקשה המקורית: "${request}"

קבצים שנמצאו: ${files.length}
קבצים שנותחו: ${filesAnalyzed.join(', ')}

תוכן שנקרא מהקבצים:
${analyzedContent}

בסיס המידע שלנו:
- שמות הקבצים: ${files.slice(0, 10).map(f => f.name).join(', ')}

אנא ספק:
1. תובנות PPC ספציפיות (4-6 תובנות מבוססות נתונים)
2. המלצות אסטרטגיות (4-6 המלצות פרקטיות)

פורמט התשובה בJSON בלבד:
{
  "ppcInsights": ["תובנה 1", "תובנה 2", ...],
  "recommendations": ["המלצה 1", "המלצה 2", ...]
}
`;

    try {
      log.info('Sending request to Gemini API');
      
      const response = await this.gemini.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: prompt,
        config: {
          temperature: 0.7,
          topP: 0.95,
          maxOutputTokens: 2000
        }
      });

      const aiResponse = response.text || '';
      log.info('Received AI response', { length: aiResponse.length });

      // Parse JSON from response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: `ניתוח נתונים - ${filesAnalyzed.length} קבצים`,
          ppcInsights: parsed.ppcInsights || [],
          recommendations: parsed.recommendations || []
        };
      }

      throw new Error('No JSON found in AI response');

    } catch (error: any) {
      log.warn('AI analysis failed, using fallback', { error: error.message });
      
      return {
        summary: `נתונים זמינים - ${files.length} קבצים`,
        ppcInsights: [
          `📊 נמצאו ${files.length} קבצים רלוונטיים`,
          `📖 ${filesAnalyzed.length} קבצים נותחו בהצלחה`,
          '💡 יש לבצע ניתוח מעמיק יותר'
        ],
        recommendations: [
          '🔹 לאסוף נתוני PPC ספציפיים',
          '🔹 לנתח ROI ועלות לקליק',
          '🔹 לבנות דאשבורד מעקב'
        ]
      };
    }
  }

  /**
   * Check if request requires calendar event
   */
  private shouldCreateCalendarEvent(request: string): boolean {
    const calendarKeywords = ['פגישה', 'פגיש', 'meeting', 'תקבע', 'לקבוע', 'calendar'];
    return calendarKeywords.some(keyword => request.toLowerCase().includes(keyword.toLowerCase()));
  }

  /**
   * Check if request requires document creation
   */
  private shouldCreateDocument(request: string): boolean {
    const docKeywords = ['אג׳נדה', 'אגנדה', 'agenda', 'מסמך', 'document', 'תכניס'];
    return docKeywords.some(keyword => request.toLowerCase().includes(keyword.toLowerCase()));
  }

  /**
   * Prepare calendar event details
   */
  private prepareEventDetails(request: string, analysis: any, files: any[]): calendar.CreateEventOptions {
    const meetingDate = new Date();
    meetingDate.setDate(meetingDate.getDate() + 2);
    meetingDate.setHours(10, 0, 0, 0);
    
    const meetingEnd = new Date(meetingDate);
    meetingEnd.setHours(11, 0, 0, 0);

    // Extract attendee emails from request if possible
    const emailPattern = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
    const emails = request.match(emailPattern) || [];
    
    // Default attendees
    const attendees = emails.length > 0 ? emails : ['ido@leadrs.co.il', 'yoav@leadrs.co.il'];

    const description = `
📊 אג'נדת הפגישה:

1. סקירת נתונים
   - ${files.length} קבצים נמצאו
   - ${analysis.ppcInsights.length} תובנות

2. תובנות PPC
${analysis.ppcInsights.map((i: string) => `   ${i}`).join('\n')}

3. המלצות אסטרטגיות
${analysis.recommendations.map((r: string) => `   ${r}`).join('\n')}

4. תכנון הצעדים הבאים

---
קבצים רלוונטיים:
${files.slice(0, 5).map(f => `- ${f.name}`).join('\n')}

נוצר אוטומטית על ידי Leaders Agents
    `.trim();

    return {
      title: 'בניית אסטרטגיה - PPC',
      description,
      start: meetingDate,
      end: meetingEnd,
      attendees
    };
  }

  /**
   * Prepare document content
   */
  private prepareDocumentContent(request: string, analysis: any, files: any[]): string {
    return `
אג'נדת פגישה: בניית אסטרטגיה
====================================================

תאריך: ${new Date().toLocaleDateString('he-IL')}

────────────────────────────────────────────────────

1. סקירת נתונים
   
   📊 נתונים שנמצאו:
   - סה"כ קבצים: ${files.length}
   - קבצים שנותחו: ${analysis.ppcInsights.length}
   
   📁 קבצים רלוונטיים:
${files.slice(0, 10).map((f: any, i: number) => `   ${i + 1}. ${f.name}`).join('\n')}

────────────────────────────────────────────────────

2. תובנות PPC

${analysis.ppcInsights.map((insight: string) => `   ${insight}`).join('\n')}

────────────────────────────────────────────────────

3. המלצות אסטרטגיות

${analysis.recommendations.map((rec: string, i: number) => `   ${i + 1}. ${rec}`).join('\n')}

────────────────────────────────────────────────────

4. תכנון הצעדים הבאים

   ☐ סיום ניתוח מעמיק של הנתונים
   ☐ חילוץ מטריקות PPC ספציפיות
   ☐ השוואה לחודשים קודמים
   ☐ הגדרת מטרות לחודש הבא
   ☐ בניית דאשבורד מעקב

────────────────────────────────────────────────────

נוצר אוטומטית על ידי Leaders Agents
תאריך יצירה: ${new Date().toLocaleString('he-IL')}
──────────────────────────────────────────────────────────────────────
`.trim();
  }
}
