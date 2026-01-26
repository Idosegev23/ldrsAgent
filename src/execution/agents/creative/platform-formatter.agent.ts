/**
 * Creative Formatting Agent
 * Agent #19 from the Multi-Agent System table
 * 
 * Uses NONE (Pure Logic) to:
 * 1. Rewrite "Master Text" into 3 distinct variations:
 *    - LinkedIn (Professional, Storytelling)
 *    - Twitter (Punchy, Thread)
 *    - Instagram Caption (Emoji-rich, CTAs)
 * 2. Ensure character limits are respected
 * 
 * Input: Drive Master Creative Text, Platform Specs Knowledge
 * Output: Platform-specific content variations
 */

import { BaseAgent } from '../../base-agent.js';
import type { Job, AgentResult, Intent } from '../../../types/index.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class PlatformFormatterAgent extends BaseAgent {
  id = 'creative/platform-formatter';
  name = 'Creative Formatting Agent';
  nameHebrew = 'סוכן פורמט קריאייטיב';
  layer = 2 as const;
  domain = 'creative';
  description = 'מתאים קריאייטיב לפלטפורמות שונות (אינסטגרם, טיקטוק, יוטיוב, פייסבוק)';
  capabilities = [
    'platform-adaptation',
    'format-conversion',
    'specs-compliance',
    'caption-writing',
  ];
  
  // Agent #19 - Uses NONE (Pure Logic)
  protected geminiTools: GeminiTool[] = [];

  canHandle(intent: Intent): boolean {
    if (intent.primary === 'creative_format') return true;
    return false;
  }

  async execute(job: Job): Promise<AgentResult> {
    const jobLog = this.log.child({ jobId: job.id });
    jobLog.info('Starting content formatting');

    try {
      const params = this.extractParameters(job.rawInput);

      if (!params.content && !params.concept) {
        return this.failure('לא סופק תוכן או קונספט לפורמט');
      }

      // Get target platforms
      const platforms = params.platforms || ['instagram', 'tiktok', 'facebook'];

      // Generate formatted versions for each platform
      const formattedContent: PlatformContent[] = [];
      
      for (const platform of platforms) {
        const formatted = await this.formatForPlatform(
          platform,
          params.content || params.concept || '',
          params.brandTone
        );
        formattedContent.push(formatted);
      }

      // Format output
      const output = this.formatOutput(formattedContent, params);

      return this.success(output, {
        structured: { formattedContent, params },
        confidence: 'high',
      });
    } catch (error) {
      jobLog.error('Content formatting failed', error as Error);
      return this.failure('אירעה שגיאה בהתאמת התוכן');
    }
  }

  private extractParameters(input: string): FormatParams {
    const params: FormatParams = {};

    // Extract platforms
    const platforms: string[] = [];
    if (input.includes('אינסטגרם') || input.includes('instagram')) platforms.push('instagram');
    if (input.includes('טיקטוק') || input.includes('tiktok')) platforms.push('tiktok');
    if (input.includes('פייסבוק') || input.includes('facebook')) platforms.push('facebook');
    if (input.includes('יוטיוב') || input.includes('youtube')) platforms.push('youtube');
    if (input.includes('לינקדאין') || input.includes('linkedin')) platforms.push('linkedin');
    if (platforms.length > 0) params.platforms = platforms;

    // Extract content type
    if (input.includes('רילים') || input.includes('reels')) params.contentType = 'reel';
    else if (input.includes('סטוריז') || input.includes('stories')) params.contentType = 'story';
    else if (input.includes('פוסט') || input.includes('post')) params.contentType = 'post';
    else if (input.includes('וידאו') || input.includes('video')) params.contentType = 'video';

    // Extract content/concept from input
    const contentMatch = input.match(/(?:תוכן|קונספט|רעיון)[:\s]+["']?([^"']+)["']?/);
    if (contentMatch) params.content = contentMatch[1].trim();

    // If no specific content, use the whole input as concept
    if (!params.content) {
      params.concept = input;
    }

    return params;
  }

  private async formatForPlatform(
    platform: string,
    content: string,
    _brandTone?: string
  ): Promise<PlatformContent> {
    const specs = this.getPlatformSpecs(platform);
    
    // Generate platform-specific caption
    const caption = this.generateCaption(content, platform);
    
    // Generate hashtags
    const hashtags = this.generateHashtags(content, platform);

    return {
      platform,
      specs,
      caption,
      hashtags,
      hooks: this.generateHooks(content, platform),
      cta: this.generateCTA(platform),
      tips: this.getPlatformTips(platform),
    };
  }

  private getPlatformSpecs(platform: string): PlatformSpecs {
    const specsMap: Record<string, PlatformSpecs> = {
      instagram: {
        reelSize: '1080x1920',
        feedSize: '1080x1080',
        storySize: '1080x1920',
        maxDuration: { reel: 90, story: 15 },
        captionLimit: 2200,
        hashtagLimit: 30,
      },
      tiktok: {
        videoSize: '1080x1920',
        maxDuration: { video: 180 },
        captionLimit: 2200,
        hashtagLimit: 10,
      },
      facebook: {
        videoSize: '1280x720',
        imageSize: '1200x630',
        maxDuration: { video: 240, story: 20 },
        captionLimit: 63206,
        hashtagLimit: 5,
      },
      youtube: {
        videoSize: '1920x1080',
        shortSize: '1080x1920',
        thumbnailSize: '1280x720',
        maxDuration: { short: 60 },
        descriptionLimit: 5000,
        hashtagLimit: 15,
      },
      linkedin: {
        videoSize: '1920x1080',
        imageSize: '1200x1200',
        maxDuration: { video: 600 },
        captionLimit: 3000,
        hashtagLimit: 5,
      },
    };

    return specsMap[platform] || specsMap['instagram'];
  }

  private generateCaption(content: string, platform: string): string {
    // Platform-specific caption styles
    const styles: Record<string, string> = {
      instagram: 'אישי ואותנטי, עם שאלה או קריאה לפעולה',
      tiktok: 'קצר וקליט, עם אמוג\'ים',
      facebook: 'יותר פורמלי, מפורט יותר',
      youtube: 'מתאר את הוידאו עם מילות מפתח',
      linkedin: 'מקצועי וערכי',
    };

    const baseCaption = content.length > 100 ? content.slice(0, 100) + '...' : content;
    
    return `[טיוטת קפשן - ${styles[platform] || 'סגנון כללי'}]\n\n${baseCaption}\n\n[התאם לסגנון המותג]`;
  }

  private generateHashtags(content: string, platform: string): string[] {
    const baseHashtags = ['#ad', '#שיתוףפעולה'];
    
    // Extract keywords from content
    const words = content.split(/\s+/).filter(w => w.length > 3);
    const keywordHashtags = words.slice(0, 3).map(w => `#${w.replace(/[^\w\u0590-\u05FF]/g, '')}`);

    // Platform-specific hashtags
    const platformHashtags: Record<string, string[]> = {
      instagram: ['#instagramisrael', '#influencermarketing'],
      tiktok: ['#fyp', '#foryou', '#viral'],
      facebook: [],
      youtube: ['#shorts', '#youtube'],
      linkedin: ['#marketing', '#business'],
    };

    return [...baseHashtags, ...keywordHashtags, ...(platformHashtags[platform] || [])];
  }

  private generateHooks(_content: string, platform: string): string[] {
    const hooks: string[] = [];

    if (platform === 'tiktok' || platform === 'instagram') {
      hooks.push('שימו לב לזה...');
      hooks.push('מה שאף אחד לא מספר לכם על...');
      hooks.push('3 דברים שצריך לדעת על...');
      hooks.push('הנה הסוד של...');
    }

    if (platform === 'youtube') {
      hooks.push('בוידאו הזה אני אראה לכם...');
      hooks.push('אם אתם רוצים לדעת איך...');
    }

    if (platform === 'linkedin') {
      hooks.push('הנה מה שלמדתי על...');
      hooks.push('טעות נפוצה ב...');
    }

    return hooks;
  }

  private generateCTA(platform: string): string {
    const ctas: Record<string, string> = {
      instagram: 'תייגו חבר שצריך לראות את זה! 👇',
      tiktok: 'עקבו לעוד תוכן כזה! ✨',
      facebook: 'שתפו עם מי שזה יכול לעזור לו',
      youtube: 'לייק ומנוי לערוץ! 🔔',
      linkedin: 'מה דעתכם? נשמח לשמוע בתגובות',
    };

    return ctas[platform] || 'מה דעתכם?';
  }

  private getPlatformTips(platform: string): string[] {
    const tipsMap: Record<string, string[]> = {
      instagram: [
        'הוק חזק ב-3 שניות הראשונות',
        'השתמשו במוזיקה טרנדית',
        'כתוביות תמיד - רוב הצפיות בלי סאונד',
        'פרסום בשעות 10-14, 19-21',
      ],
      tiktok: [
        'הוק אגרסיבי בשנייה הראשונה',
        'השתמשו בטרנדים וסאונדים פופולריים',
        'אל תמכרו - תבדרו',
        'קצב מהיר = צפיות',
      ],
      facebook: [
        'תוכן ארוך יותר מתאים',
        'וידאו עם כתוביות',
        'שאלות יוצרות מעורבות',
        'שיתופים > לייקים',
      ],
      youtube: [
        'תאנייל מושך = 50% מההצלחה',
        'כותרת עם מילות מפתח',
        'תיאור מפורט',
        '8-12 דקות = אורך אידיאלי',
      ],
      linkedin: [
        'תוכן ערכי ומקצועי',
        'סיפורים אישיים עובדים',
        'פסקאות קצרות',
        'תייגו אנשים רלוונטיים',
      ],
    };

    return tipsMap[platform] || [];
  }

  private formatOutput(content: PlatformContent[], params: FormatParams): string {
    const lines: string[] = [
      '# 📱 התאמת תוכן לפלטפורמות',
      '',
    ];

    if (params.content || params.concept) {
      lines.push(`**קונספט מקורי:** ${params.content || params.concept}`);
      lines.push('');
    }

    lines.push('---');
    lines.push('');

    for (const platform of content) {
      lines.push(`## ${this.getPlatformEmoji(platform.platform)} ${this.getPlatformName(platform.platform)}`);
      lines.push('');
      
      // Specs
      lines.push('### 📐 מפרט טכני');
      if (platform.specs.reelSize) lines.push(`- Reel: ${platform.specs.reelSize}`);
      if (platform.specs.feedSize) lines.push(`- Feed: ${platform.specs.feedSize}`);
      if (platform.specs.videoSize) lines.push(`- Video: ${platform.specs.videoSize}`);
      if (platform.specs.maxDuration) {
        const durations = Object.entries(platform.specs.maxDuration)
          .map(([k, v]) => `${k}: ${v}s`)
          .join(', ');
        lines.push(`- משך מקסימלי: ${durations}`);
      }
      lines.push('');

      // Caption
      lines.push('### ✍️ קפשן');
      lines.push('```');
      lines.push(platform.caption);
      lines.push('```');
      lines.push('');

      // Hashtags
      lines.push('### #️⃣ האשטאגים');
      lines.push(platform.hashtags.join(' '));
      lines.push('');

      // Hooks
      if (platform.hooks.length > 0) {
        lines.push('### 🎣 הוקים מומלצים');
        lines.push(...platform.hooks.map((h: string) => `- "${h}"`));
        lines.push('');
      }

      // CTA
      lines.push('### 📢 קריאה לפעולה');
      lines.push(`"${platform.cta}"`);
      lines.push('');

      // Tips
      if (platform.tips.length > 0) {
        lines.push('### 💡 טיפים');
        lines.push(...platform.tips.map((t: string) => `- ${t}`));
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }

  private getPlatformEmoji(platform: string): string {
    const emojis: Record<string, string> = {
      instagram: '📸',
      tiktok: '🎵',
      facebook: '👍',
      youtube: '▶️',
      linkedin: '💼',
    };
    return emojis[platform] || '📱';
  }

  private getPlatformName(platform: string): string {
    const names: Record<string, string> = {
      instagram: 'Instagram',
      tiktok: 'TikTok',
      facebook: 'Facebook',
      youtube: 'YouTube',
      linkedin: 'LinkedIn',
    };
    return names[platform] || platform;
  }
}

interface FormatParams {
  platforms?: string[];
  contentType?: string;
  content?: string;
  concept?: string;
  brandTone?: string;
}

interface PlatformSpecs {
  reelSize?: string;
  feedSize?: string;
  storySize?: string;
  videoSize?: string;
  imageSize?: string;
  shortSize?: string;
  thumbnailSize?: string;
  maxDuration?: Record<string, number>;
  captionLimit?: number;
  descriptionLimit?: number;
  hashtagLimit?: number;
}

interface PlatformContent {
  platform: string;
  specs: PlatformSpecs;
  caption: string;
  hashtags: string[];
  hooks: string[];
  cta: string;
  tips: string[];
}
