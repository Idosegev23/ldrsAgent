/**
 * Canva Agent
 * Handles Canva operations through natural language
 */

import { GoogleGenAI } from '@google/genai';
import * as canva from '../../integrations/connectors/canva.connector.js';
import { logger } from '../../utils/logger.js';
import type { ExecutionContext } from '../../types/execution.types.js';

const log = logger.child({ component: 'CanvaAgent' });

export interface CanvaExecutionParams {
  userId: string;
  request: string;
  executionId: string;
  context?: ExecutionContext;
}

export interface CanvaExecutionResult {
  action: string;
  success: boolean;
  data?: any;
  summary: string;
  error?: string;
}

export class CanvaAgent {
  private gemini: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }
    this.gemini = new GoogleGenAI({ apiKey });
  }

  /**
   * Execute Canva operation based on natural language request
   */
  async execute(params: CanvaExecutionParams): Promise<CanvaExecutionResult> {
    const { userId, request, executionId } = params;

    log.info('Starting Canva execution', { userId, executionId, request: request.substring(0, 100) });

    try {
      // Parse intent using AI
      const intent = await this.parseIntent(request);
      log.info('Intent parsed', { intent: intent.action });

      // Execute based on intent
      switch (intent.action) {
        case 'LIST_DESIGNS':
          return await this.listDesigns(userId, intent.params);

        case 'SEARCH_DESIGNS':
          return await this.searchDesigns(userId, intent.params);

        case 'CREATE_DESIGN':
          return await this.createDesign(userId, intent.params);

        case 'EXPORT_DESIGN':
          return await this.exportDesign(userId, intent.params);

        case 'UPLOAD_ASSET':
          return await this.uploadAsset(userId, intent.params);

        case 'LIST_TEMPLATES':
          return await this.listTemplates(userId, intent.params);

        default:
          return {
            action: 'UNKNOWN',
            success: false,
            summary: 'לא הצלחתי להבין את הבקשה',
            error: 'Unknown action',
          };
      }
    } catch (error: any) {
      log.error('Canva execution failed', error as Error, { executionId, userId });
      return {
        action: 'ERROR',
        success: false,
        summary: `שגיאה: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Parse user request to determine intent and parameters
   */
  private async parseIntent(request: string): Promise<{ action: string; params: any }> {
    const prompt = `
אתה מנתח בקשות למערכת Canva. נתח את הבקשה הבאה וקבע:
1. פעולה (action): LIST_DESIGNS, SEARCH_DESIGNS, CREATE_DESIGN, EXPORT_DESIGN, UPLOAD_ASSET, LIST_TEMPLATES
2. פרמטרים נדרשים

בקשה: "${request}"

החזר JSON בפורמט:
{
  "action": "ACTION_NAME",
  "params": {
    "search": "מילות חיפוש",
    "title": "כותרת",
    "format": "PNG|PDF|JPG",
    "templateId": "template_id",
    "tags": ["tag1", "tag2"]
  }
}

דוגמאות:
- "הראה לי את כל הדיזיינים" → {"action": "LIST_DESIGNS", "params": {}}
- "חפש דיזיינים של מותג X" → {"action": "SEARCH_DESIGNS", "params": {"search": "מותג X"}}
- "צור פוסט אינסטגרם חדש" → {"action": "CREATE_DESIGN", "params": {"title": "פוסט אינסטגרם"}}
- "ייצא את הדיזיין ל-PDF" → {"action": "EXPORT_DESIGN", "params": {"format": "PDF"}}
`;

    try {
      const response = await this.gemini.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: prompt,
        config: {
          temperature: 0.3,
          maxOutputTokens: 500,
        },
      });

      const text = response.text || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback
      return { action: 'LIST_DESIGNS', params: {} };
    } catch (error) {
      log.warn('Failed to parse intent, using fallback', { error });
      return { action: 'LIST_DESIGNS', params: {} };
    }
  }

  /**
   * List all designs
   */
  private async listDesigns(
    userId: string,
    params: any
  ): Promise<CanvaExecutionResult> {
    log.info('Listing designs', { userId });

    const result = await canva.listDesigns(userId, {
      limit: params.limit || 20,
      sortBy: 'modified',
    });

    const designs = result.designs;

    return {
      action: 'LIST_DESIGNS',
      success: true,
      data: { designs, count: designs.length },
      summary: `נמצאו ${designs.length} דיזיינים:\n${designs
        .slice(0, 5)
        .map((d, i) => `${i + 1}. ${d.title} (עודכן: ${new Date(d.updated_at).toLocaleDateString('he-IL')})`)
        .join('\n')}${designs.length > 5 ? `\n...ועוד ${designs.length - 5}` : ''}`,
    };
  }

  /**
   * Search designs
   */
  private async searchDesigns(
    userId: string,
    params: any
  ): Promise<CanvaExecutionResult> {
    const query = params.search || '';
    log.info('Searching designs', { userId, query });

    const designs = await canva.searchDesigns(userId, query, {
      limit: params.limit || 10,
    });

    return {
      action: 'SEARCH_DESIGNS',
      success: true,
      data: { designs, count: designs.length, query },
      summary: `חיפוש "${query}" מצא ${designs.length} דיזיינים:\n${designs
        .map((d, i) => `${i + 1}. ${d.title}`)
        .join('\n')}`,
    };
  }

  /**
   * Create new design
   */
  private async createDesign(
    userId: string,
    params: any
  ): Promise<CanvaExecutionResult> {
    log.info('Creating design', { userId, params });

    const design = await canva.createDesign(userId, {
      title: params.title || 'דיזיין חדש',
      assetId: params.templateId,
    });

    return {
      action: 'CREATE_DESIGN',
      success: true,
      data: { design },
      summary: `✅ נוצר דיזיין חדש: "${design.title}"\n\n🔗 לחץ לעריכה: ${design.urls.edit_url}`,
    };
  }

  /**
   * Export design
   */
  private async exportDesign(
    userId: string,
    params: any
  ): Promise<CanvaExecutionResult> {
    const designId = params.designId;
    const format = (params.format || 'PDF') as 'PNG' | 'JPG' | 'PDF' | 'GIF';

    if (!designId) {
      return {
        action: 'EXPORT_DESIGN',
        success: false,
        summary: 'חסר מזהה דיזיין לייצוא',
        error: 'Missing design ID',
      };
    }

    log.info('Exporting design', { userId, designId, format });

    const result = await canva.exportDesign(designId, userId, format);

    return {
      action: 'EXPORT_DESIGN',
      success: true,
      data: { exportUrl: result.url, format },
      summary: `✅ הדיזיין יוצא ב-${format}\n\n📥 להורדה: ${result.url}\n\n⏰ הקישור תקף ל-24 שעות`,
    };
  }

  /**
   * Upload asset
   */
  private async uploadAsset(
    userId: string,
    params: any
  ): Promise<CanvaExecutionResult> {
    log.info('Uploading asset', { userId, name: params.name });

    if (!params.file && !params.url) {
      return {
        action: 'UPLOAD_ASSET',
        success: false,
        summary: 'חסר קובץ או URL להעלאה',
        error: 'Missing file or URL',
      };
    }

    const asset = await canva.uploadAsset(userId, {
      file: params.file,
      url: params.url,
      name: params.name || 'קובץ חדש',
      tags: params.tags || [],
    });

    return {
      action: 'UPLOAD_ASSET',
      success: true,
      data: { asset },
      summary: `✅ הקובץ הועלה בהצלחה: "${asset.name}"\n\nסוג: ${asset.type}\nתגיות: ${asset.tags.join(', ') || 'אין'}`,
    };
  }

  /**
   * List brand templates
   */
  private async listTemplates(
    userId: string,
    params: any
  ): Promise<CanvaExecutionResult> {
    log.info('Listing templates', { userId });

    const result = await canva.listBrandTemplates(userId, {
      search: params.search,
      limit: params.limit || 10,
    });

    const templates = result.templates;

    return {
      action: 'LIST_TEMPLATES',
      success: true,
      data: { templates, count: templates.length },
      summary: `נמצאו ${templates.length} תבניות מותג`,
    };
  }
}
