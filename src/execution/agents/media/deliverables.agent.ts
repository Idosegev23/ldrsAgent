/**
 * Media Deliverables Template Agent
 * Agent #7 from the Multi-Agent System table
 * 
 * Uses NONE (Pure Logic) to:
 * 1. Generate clear, predefined templates for each deliverable type
 * 2. Define structure, formats, limitations and highlights per platform
 * 3. Create "work framework" that prevents errors before they happen
 * 
 * Input: Campaign type, platforms, content requirements
 * Output: Detailed deliverables list with specs per platform
 */

import { BaseAgent } from '../../base-agent.js';
import type { Job, AgentResult, Intent } from '../../../types/index.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class MediaDeliverablesAgent extends BaseAgent {
  id = 'media/deliverables';
  name = 'Media Deliverables Template Agent';
  nameHebrew = 'סוכן תוצרים מדיה';
  layer = 2 as const;
  domain = 'media';
  description = 'יוצר תוצרים לפי טמפלט וצרכי מדיה (גדלים, נגזרות, פלטפורמות)';
  capabilities = [
    'deliverables-creation',
    'format-adaptation',
    'platform-specs',
    'template-usage',
  ];
  
  // Agent #7 - Uses NONE (Pure Logic)
  protected geminiTools: GeminiTool[] = [];

  canHandle(intent: Intent): boolean {
    if (intent.primary === 'media_deliverables') return true;
    if (intent.entities.action === 'create' && intent.entities.domain === 'media') return true;
    return false;
  }

  async execute(job: Job): Promise<AgentResult> {
    const jobLog = this.log.child({ jobId: job.id });
    jobLog.info('Creating media deliverables');

    try {
      const params = this.extractParameters(job.rawInput);

      // Get platform specifications
      const specs = this.getPlatformSpecs(params.platforms || ['instagram', 'tiktok']);

      // Generate deliverables list
      const deliverables = this.generateDeliverables(params, specs);

      // Format output
      const output = this.formatOutput(params, deliverables, specs);

      return this.success(output, {
        structured: {
          params,
          deliverables,
          specs,
        },
        confidence: 'high',
      });
    } catch (error) {
      jobLog.error('Deliverables creation failed', error as Error);
      return this.failure('אירעה שגיאה ביצירת התוצרים');
    }
  }

  private extractParameters(input: string): DeliverableParams {
    const params: DeliverableParams = {};

    // Extract platforms
    const platforms: string[] = [];
    if (input.includes('אינסטגרם') || input.includes('instagram')) platforms.push('instagram');
    if (input.includes('טיקטוק') || input.includes('tiktok')) platforms.push('tiktok');
    if (input.includes('פייסבוק') || input.includes('facebook')) platforms.push('facebook');
    if (input.includes('יוטיוב') || input.includes('youtube')) platforms.push('youtube');
    if (input.includes('לינקדאין') || input.includes('linkedin')) platforms.push('linkedin');
    if (platforms.length > 0) params.platforms = platforms;

    // Extract content types
    const types: string[] = [];
    if (input.includes('רילים') || input.includes('reels')) types.push('reels');
    if (input.includes('סטוריז') || input.includes('stories')) types.push('stories');
    if (input.includes('פוסט') || input.includes('post')) types.push('post');
    if (input.includes('קרוסלה') || input.includes('carousel')) types.push('carousel');
    if (input.includes('וידאו') || input.includes('video')) types.push('video');
    if (types.length > 0) params.contentTypes = types;

    // Extract campaign type
    if (input.includes('השקה') || input.includes('launch')) params.campaignType = 'launch';
    else if (input.includes('מבצע') || input.includes('sale')) params.campaignType = 'sale';
    else if (input.includes('מודעות') || input.includes('awareness')) params.campaignType = 'awareness';
    else if (input.includes('מעורבות') || input.includes('engagement')) params.campaignType = 'engagement';

    // Extract brand if mentioned
    const brandMatch = input.match(/(?:מותג|לקוח|עבור)\s+["']?([א-תA-Za-z0-9\s]+)["']?/);
    if (brandMatch) params.brandName = brandMatch[1].trim();

    return params;
  }

  private getPlatformSpecs(platforms: string[]): PlatformSpec[] {
    const allSpecs: Record<string, PlatformSpec> = {
      instagram: {
        platform: 'Instagram',
        formats: [
          { type: 'Feed Post', size: '1080x1080', ratio: '1:1', maxDuration: null },
          { type: 'Story', size: '1080x1920', ratio: '9:16', maxDuration: 15 },
          { type: 'Reel', size: '1080x1920', ratio: '9:16', maxDuration: 90 },
          { type: 'Carousel', size: '1080x1080', ratio: '1:1', maxDuration: null, slides: 10 },
        ],
        bestPractices: [
          'השתמשו בהשטאגים רלוונטיים (5-10)',
          'פרסום בשעות פעילות (10-14, 19-21)',
          'קריאה לפעולה ברורה',
        ],
      },
      tiktok: {
        platform: 'TikTok',
        formats: [
          { type: 'Video', size: '1080x1920', ratio: '9:16', maxDuration: 180 },
        ],
        bestPractices: [
          'הוק חזק ב-3 שניות הראשונות',
          'השתמשו בטרנדים ומוזיקה פופולרית',
          'CTA בסוף הווידאו',
        ],
      },
      facebook: {
        platform: 'Facebook',
        formats: [
          { type: 'Feed Post', size: '1200x630', ratio: '1.91:1', maxDuration: null },
          { type: 'Story', size: '1080x1920', ratio: '9:16', maxDuration: 20 },
          { type: 'Video', size: '1280x720', ratio: '16:9', maxDuration: 240 },
        ],
        bestPractices: [
          'טקסט קצר ותמציתי',
          'תמונות איכותיות',
          'שאלות ליצירת מעורבות',
        ],
      },
      youtube: {
        platform: 'YouTube',
        formats: [
          { type: 'Video', size: '1920x1080', ratio: '16:9', maxDuration: null },
          { type: 'Short', size: '1080x1920', ratio: '9:16', maxDuration: 60 },
          { type: 'Thumbnail', size: '1280x720', ratio: '16:9', maxDuration: null },
        ],
        bestPractices: [
          'כותרת מושכת עם מילות מפתח',
          'תאנייל בולט ומזמין',
          'תיאור מפורט עם קישורים',
        ],
      },
      linkedin: {
        platform: 'LinkedIn',
        formats: [
          { type: 'Post', size: '1200x1200', ratio: '1:1', maxDuration: null },
          { type: 'Article Image', size: '1200x644', ratio: '1.91:1', maxDuration: null },
          { type: 'Video', size: '1920x1080', ratio: '16:9', maxDuration: 600 },
        ],
        bestPractices: [
          'טון מקצועי ועניני',
          'תוכן ערכי ומעשיר',
          'תיוג אנשים רלוונטיים',
        ],
      },
    };

    return platforms.map(p => allSpecs[p]).filter(Boolean);
  }

  private generateDeliverables(params: DeliverableParams, specs: PlatformSpec[]): Deliverable[] {
    const deliverables: Deliverable[] = [];
    const contentTypes = params.contentTypes || ['reels', 'stories', 'post'];

    for (const spec of specs) {
      for (const format of spec.formats) {
        // Match content types to formats
        const formatType = format.type.toLowerCase();
        const shouldInclude = contentTypes.some(ct => 
          formatType.includes(ct) || 
          (ct === 'video' && format.maxDuration) ||
          (ct === 'post' && formatType.includes('post'))
        );

        if (shouldInclude || contentTypes.length === 0) {
          deliverables.push({
            platform: spec.platform,
            type: format.type,
            size: format.size,
            ratio: format.ratio,
            maxDuration: format.maxDuration,
            quantity: this.getRecommendedQuantity(format.type, params.campaignType),
            notes: this.getDeliverableNotes(format.type, spec.platform),
          });
        }
      }
    }

    return deliverables;
  }

  private getRecommendedQuantity(type: string, campaignType?: string): number {
    const baseQuantities: Record<string, number> = {
      'Feed Post': 2,
      'Story': 6,
      'Reel': 2,
      'Carousel': 1,
      'Video': 1,
      'Short': 2,
      'Post': 2,
    };

    let quantity = baseQuantities[type] || 1;

    if (campaignType === 'launch') quantity *= 1.5;
    if (campaignType === 'sale') quantity *= 2;

    return Math.round(quantity);
  }

  private getDeliverableNotes(type: string, _platform: string): string {
    const notes: Record<string, string> = {
      'Reel': 'תוכן דינמי עם הוק חזק בהתחלה',
      'Story': 'תוכן אותנטי עם אינטראקציה',
      'Carousel': 'סיפור עם עומק - slide ראשון מושך',
      'Video': 'פתיחה חזקה וקריאה לפעולה בסוף',
      'Short': 'טרנדי וקצב מהיר',
    };

    return notes[type] || 'תוכן איכותי ומותאם לפלטפורמה';
  }

  private formatOutput(
    params: DeliverableParams,
    deliverables: Deliverable[],
    specs: PlatformSpec[]
  ): string {
    const lines: string[] = [
      '# 📦 רשימת תוצרים מדיה',
      '',
    ];

    if (params.brandName) {
      lines.push(`**מותג:** ${params.brandName}`);
    }
    if (params.campaignType) {
      lines.push(`**סוג קמפיין:** ${params.campaignType}`);
    }
    lines.push(`**פלטפורמות:** ${specs.map(s => s.platform).join(', ')}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Group by platform
    const byPlatform = new Map<string, Deliverable[]>();
    for (const d of deliverables) {
      if (!byPlatform.has(d.platform)) {
        byPlatform.set(d.platform, []);
      }
      byPlatform.get(d.platform)!.push(d);
    }

    for (const [platformName, items] of byPlatform) {
      lines.push(`## ${platformName}`);
      lines.push('');
      lines.push('| תוצר | גודל | יחס | משך | כמות | הערות |');
      lines.push('|------|------|-----|-----|------|-------|');
      
      for (const item of items) {
        const duration = item.maxDuration ? `${item.maxDuration}s` : '-';
        lines.push(`| ${item.type} | ${item.size} | ${item.ratio} | ${duration} | ${item.quantity} | ${item.notes} |`);
      }
      lines.push('');

      // Add best practices for this platform
      const spec = specs.find(s => s.platform === platformName);
      if (spec?.bestPractices) {
        lines.push('**טיפים:**');
        lines.push(...spec.bestPractices.map(tip => `- ${tip}`));
        lines.push('');
      }
    }

    // Summary
    lines.push('---');
    lines.push('');
    lines.push('## 📊 סיכום');
    lines.push('');
    
    const totalDeliverables = deliverables.reduce((sum, d) => sum + d.quantity, 0);
    lines.push(`**סה"כ תוצרים:** ${totalDeliverables}`);
    lines.push('');
    
    lines.push('| פלטפורמה | תוצרים |');
    lines.push('|----------|--------|');
    for (const [platformName, items] of byPlatform) {
      const count = items.reduce((sum, d) => sum + d.quantity, 0);
      lines.push(`| ${platformName} | ${count} |`);
    }

    return lines.join('\n');
  }
}

interface DeliverableParams {
  platforms?: string[];
  contentTypes?: string[];
  campaignType?: string;
  brandName?: string;
}

interface PlatformSpec {
  platform: string;
  formats: {
    type: string;
    size: string;
    ratio: string;
    maxDuration: number | null;
    slides?: number;
  }[];
  bestPractices: string[];
}

interface Deliverable {
  platform: string;
  type: string;
  size: string;
  ratio: string;
  maxDuration: number | null;
  quantity: number;
  notes: string;
}
