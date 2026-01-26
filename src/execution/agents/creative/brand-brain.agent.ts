/**
 * Brand Brain Agent
 * Agent #6 from the Multi-Agent System table
 * 
 * Uses VISION + LONG CONTEXT to:
 * 1. Act as Brand Compliance Officer
 * 2. Analyze uploaded assets (Image/Text) against Brand Guidelines PDF
 * 3. Identify violations in Color, Tone, Typography, Messaging
 * 4. Provide specific constructive feedback
 * 
 * Input: Brand Guidelines PDF, User uploaded Image/Copy to check
 * Output: Compliance analysis with violation details and feedback
 */

import { BaseAgent } from '../../base-agent.js';
import { researchBrand, type BrandResearch } from '../../../knowledge/brand-research.js';
import type { Job, AgentResult, Intent } from '../../../types/index.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class BrandBrainAgent extends BaseAgent {
  id = 'creative/brand-brain';
  name = 'Brand Brain Agent';
  nameHebrew = 'סוכן מותאם-מותג';
  layer = 2 as const;
  domain = 'creative';
  description = 'מייצר כיוונים קריאייטיביים על בסיס מידע מעמיק על מותג מסוים';
  capabilities = [
    'brand-analysis',
    'creative-direction',
    'tone-adaptation',
    'content-strategy',
    'image-analysis',
  ];
  
  // Agent #6 - Uses VISION + LONG CONTEXT
  protected geminiTools: GeminiTool[] = [];

  canHandle(intent: Intent): boolean {
    if (intent.primary === 'brand_brain') return true;
    if (intent.primary === 'creative_ideas' && intent.entities.clientName) return true;
    return false;
  }

  async execute(job: Job): Promise<AgentResult> {
    const jobLog = this.log.child({ jobId: job.id });
    jobLog.info('Starting brand brain analysis');

    try {
      const brandName = job.intent.entities.clientName || this.extractBrandName(job.rawInput);
      
      if (!brandName) {
        return this.failure('לא צוין שם מותג. אנא ציין מותג לניתוח.');
      }

      // Research the brand
      jobLog.info('Researching brand', { brand: brandName });
      const brandResearch = await researchBrand(brandName);

      // Generate brand-specific directions
      const directions = await this.generateBrandDirections(brandResearch);

      // Generate content pillars
      const contentPillars = this.generateContentPillars(brandResearch);

      // Generate do's and don'ts
      const guidelines = this.generateGuidelines(brandResearch);

      // Format output
      const output = this.formatOutput(brandResearch, directions, contentPillars, guidelines);

      return this.success(output, {
        structured: {
          brandResearch,
          directions,
          contentPillars,
          guidelines,
        },
        citations: this.mapSourcesToCitations(brandResearch.sources || []),
        confidence: brandResearch.confidence,
      });
    } catch (error) {
      jobLog.error('Brand brain analysis failed', error as Error);
      return this.failure('אירעה שגיאה בניתוח המותג');
    }
  }

  private mapSourcesToCitations(sources: { title: string; url: string }[]): { source: string; content: string; documentId: string }[] {
    return sources.map((s, i) => ({
      source: s.url,
      content: s.title,
      documentId: `source-${i}`,
    }));
  }

  private extractBrandName(input: string): string | undefined {
    const patterns = [
      /(?:מותג|לקוח|עבור|על)\s+["']?([א-תA-Za-z0-9\s]+)["']?/,
    ];
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) return match[1].trim();
    }
    return undefined;
  }

  private async generateBrandDirections(brand: BrandResearch): Promise<BrandDirection[]> {
    const directions: BrandDirection[] = [];

    // Direction based on brand personality
    if (brand.brandPersonality && brand.brandPersonality.length > 0) {
      directions.push({
        title: 'כיוון אישיות',
        description: `תוכן שמשקף את האישיות: ${brand.brandPersonality.join(', ')}`,
        examples: brand.brandPersonality.map(p => `תוכן ${p}`),
        suitableFor: ['פוסטים', 'רילים', 'סטוריז'],
      });
    }

    // Direction based on values
    if (brand.brandValues && brand.brandValues.length > 0) {
      directions.push({
        title: 'כיוון ערכי',
        description: `תוכן שמדגיש את הערכים: ${brand.brandValues.join(', ')}`,
        examples: brand.brandValues.map(v => `סיפור על ${v}`),
        suitableFor: ['וידאו ארוך', 'קרוסלות', 'פוסטים'],
      });
    }

    // Direction based on target audience
    if (brand.targetDemographics?.primaryAudience) {
      const ta = brand.targetDemographics.primaryAudience;
      directions.push({
        title: 'כיוון קהל יעד',
        description: `תוכן שמדבר ל${ta.gender}, ${ta.ageRange}, עם תחומי עניין: ${ta.interests?.slice(0, 3).join(', ')}`,
        examples: ta.interests?.map(i => `תוכן על ${i}`) || [],
        suitableFor: ['כל הפלטפורמות'],
      });
    }

    // Direction based on industry trends
    if (brand.industryTrends && brand.industryTrends.length > 0) {
      directions.push({
        title: 'כיוון טרנדים',
        description: `תוכן שמתחבר לטרנדים בתעשייה`,
        examples: brand.industryTrends.slice(0, 3),
        suitableFor: ['טיקטוק', 'רילים'],
      });
    }

    // Default direction if none found
    if (directions.length === 0) {
      directions.push({
        title: 'כיוון כללי',
        description: 'תוכן אותנטי שמציג את המותג בצורה טבעית',
        examples: ['יום בחיים', 'מאחורי הקלעים', 'סיפור לקוח'],
        suitableFor: ['כל הפלטפורמות'],
      });
    }

    return directions;
  }

  private generateContentPillars(brand: BrandResearch): ContentPillar[] {
    const pillars: ContentPillar[] = [];

    // Education pillar
    pillars.push({
      name: 'חינוך וערך',
      description: `תוכן שמלמד משהו על ${brand.industry}`,
      ratio: 30,
      examples: ['טיפים', 'הסברים', 'מדריכים'],
    });

    // Entertainment pillar
    pillars.push({
      name: 'בידור',
      description: 'תוכן קליל ומבדר שמושך תשומת לב',
      ratio: 25,
      examples: ['טרנדים', 'הומור', 'challenges'],
    });

    // Inspiration pillar
    pillars.push({
      name: 'השראה',
      description: 'תוכן שמעורר השראה ורגש',
      ratio: 20,
      examples: ['סיפורי הצלחה', 'מוטיבציה', 'ערכים'],
    });

    // Product pillar
    pillars.push({
      name: 'מוצר',
      description: 'הצגת המוצרים והשירותים',
      ratio: 15,
      examples: ['דמו', 'reviews', 'השקות'],
    });

    // Community pillar
    pillars.push({
      name: 'קהילה',
      description: 'תוכן שבונה קשר עם הקהל',
      ratio: 10,
      examples: ['Q&A', 'UGC', 'שיתופים'],
    });

    return pillars;
  }

  private generateGuidelines(brand: BrandResearch): BrandGuidelines {
    const dos: string[] = [];
    const donts: string[] = [];

    // Based on tone
    if (brand.toneOfVoice) {
      dos.push(`שמירה על טון ${brand.toneOfVoice}`);
      if (brand.toneOfVoice.includes('מקצועי')) {
        donts.push('שימוש בסלנג או שפה לא מקצועית');
      }
    }

    // Based on brand values
    if (brand.brandValues) {
      for (const value of brand.brandValues.slice(0, 2)) {
        dos.push(`הדגשת ${value} בתוכן`);
      }
    }

    // Based on target audience
    if (brand.targetDemographics?.primaryAudience) {
      dos.push(`תוכן שמדבר לקהל ${brand.targetDemographics.primaryAudience.ageRange}`);
    }

    // General guidelines
    dos.push('תוכן אותנטי ואמיתי');
    dos.push('איכות ויזואלית גבוהה');
    dos.push('קריאה לפעולה ברורה');

    donts.push('הבטחות מופרזות');
    donts.push('תוכן שלילי על מתחרים');
    donts.push('סגנון לא עקבי');

    return { dos, donts };
  }

  private formatOutput(
    brand: BrandResearch,
    directions: BrandDirection[],
    pillars: ContentPillar[],
    guidelines: BrandGuidelines
  ): string {
    const lines: string[] = [
      `# 🧠 Brand Brain: ${brand.brandName}`,
      '',
      '---',
      '',
      '## סקירת מותג',
      '',
      brand.companyDescription,
      '',
      `**טון:** ${brand.toneOfVoice || 'מקצועי'}`,
      `**אישיות:** ${brand.brandPersonality?.join(', ') || 'לא מוגדר'}`,
      `**ערכים:** ${brand.brandValues?.join(', ') || 'לא מוגדר'}`,
      '',
      '---',
      '',
      '## 🎯 כיוונים קריאייטיביים',
      '',
    ];

    for (const direction of directions) {
      lines.push(`### ${direction.title}`);
      lines.push(direction.description);
      lines.push('');
      lines.push('**דוגמאות:**');
      lines.push(...direction.examples.map(e => `- ${e}`));
      lines.push('');
      lines.push(`**מתאים ל:** ${direction.suitableFor.join(', ')}`);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('## 📊 עמודי תוכן');
    lines.push('');
    lines.push('| עמוד | יחס | תיאור |');
    lines.push('|------|-----|-------|');
    for (const pillar of pillars) {
      lines.push(`| ${pillar.name} | ${pillar.ratio}% | ${pillar.description} |`);
    }
    lines.push('');

    lines.push('---');
    lines.push('');
    lines.push('## ✅ Do\'s');
    lines.push('');
    lines.push(...guidelines.dos.map(d => `- ${d}`));
    lines.push('');

    lines.push('## ❌ Don\'ts');
    lines.push('');
    lines.push(...guidelines.donts.map(d => `- ${d}`));
    lines.push('');

    lines.push('---');
    lines.push('');
    lines.push(`*רמת ביטחון: ${brand.confidence}*`);

    return lines.join('\n');
  }
}

interface BrandDirection {
  title: string;
  description: string;
  examples: string[];
  suitableFor: string[];
}

interface ContentPillar {
  name: string;
  description: string;
  ratio: number;
  examples: string[];
}

interface BrandGuidelines {
  dos: string[];
  donts: string[];
}
