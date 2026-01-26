/**
 * Deep Research / Competitor & Market Intel Agent
 * Agent #3 from the Multi-Agent System table
 * 
 * Uses GROUNDING (Search) to:
 * 1. Map competitors, messages, business models, market trends
 * 2. Return clear picture that positions brand in the arena
 * 3. Enable reality-based decision making
 * 
 * Input: Brand name, competitor list, market segment
 * Output: Comprehensive market intelligence report
 */

import { BaseAgent } from '../../base-agent.js';
import { researchBrand, type BrandResearch } from '../../../knowledge/brand-research.js';
import { scrapeWebsite } from '../../../integrations/apify/scraper.js';
import type { Job, AgentResult, Intent } from '../../../types/index.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class DeepResearchAgent extends BaseAgent {
  id = 'research/deep-research';
  name = 'Deep Research Agent';
  nameHebrew = 'סוכן מחקר עומק';
  layer = 2 as const;
  domain = 'research';
  description = 'מבצע מחקר מעמיק על מותגים, מתחרים, תוצרי משפיענים וסושיאל';
  capabilities = [
    'deep-brand-research',
    'competitor-analysis',
    'social-analysis',
    'market-research',
  ];
  
  // Agent #3 - Uses GROUNDING (Search)
  protected geminiTools: GeminiTool[] = ['grounding'];

  canHandle(intent: Intent): boolean {
    if (intent.primary === 'deep_research') return true;
    if (intent.primary === 'competitor_analysis') return true;
    if (intent.primary === 'research_brand' && intent.entities.action === 'deep') return true;
    return false;
  }

  async execute(job: Job): Promise<AgentResult> {
    const jobLog = this.log.child({ jobId: job.id });
    jobLog.info('Starting deep research');

    try {
      const brandName = this.extractBrandName(job.rawInput);
      
      if (!brandName) {
        return this.failure('לא צוין שם מותג למחקר');
      }

      // Scrape website if URL provided
      const websiteUrl = this.extractWebsiteUrl(job.rawInput);
      let websiteData: Awaited<ReturnType<typeof scrapeWebsite>> | undefined;
      
      if (websiteUrl) {
        jobLog.info('Scraping website', { url: websiteUrl });
        try {
          websiteData = await scrapeWebsite(websiteUrl);
        } catch (error) {
          jobLog.warn('Website scrape failed', { error });
        }
      }

      // Deep brand research
      jobLog.info('Researching brand', { brand: brandName });
      const brandResearch = await researchBrand(brandName, websiteData ? {
        url: websiteData.url,
        title: websiteData.title,
        description: websiteData.description,
        headings: [...websiteData.headings.h1, ...websiteData.headings.h2],
        paragraphs: websiteData.paragraphs,
        socialLinks: Object.values(websiteData.socialLinks).filter(Boolean) as string[],
      } : undefined);

      // Research competitors
      const competitorResearch = await this.researchCompetitors(brandResearch);

      // Analyze social presence
      const socialAnalysis = this.analyzeSocialPresence(brandResearch, websiteData);

      // Generate comprehensive report
      const output = this.formatResearchReport(
        brandResearch,
        competitorResearch,
        socialAnalysis,
        websiteData
      );

      return this.success(output, {
        structured: {
          brandResearch,
          competitorResearch,
          socialAnalysis,
          websiteData,
        },
        citations: this.mapSourcesToCitations(brandResearch.sources || []),
        confidence: brandResearch.confidence,
      });
    } catch (error) {
      jobLog.error('Deep research failed', error as Error);
      return this.failure('אירעה שגיאה במחקר');
    }
  }

  private extractBrandName(input: string): string | undefined {
    const patterns = [
      /(?:מותג|לקוח|על|חקור|מחקר)\s+["']?([א-תA-Za-z0-9\s]+)["']?/,
      /^([א-תA-Za-z0-9\s]+)\s*[-–]/,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) return match[1].trim();
    }
    return undefined;
  }

  private extractWebsiteUrl(input: string): string | undefined {
    const urlPattern = /https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(?:com|co\.il|io|net|org)/gi;
    const match = input.match(urlPattern);
    return match ? match[0] : undefined;
  }

  private mapSourcesToCitations(sources: { title: string; url: string }[]): { source: string; content: string; documentId: string }[] {
    return sources.map((s, i) => ({
      source: s.url,
      content: s.title,
      documentId: `source-${i}`,
    }));
  }

  private async researchCompetitors(brand: BrandResearch): Promise<CompetitorResearch[]> {
    const competitors: CompetitorResearch[] = [];

    if (brand.competitors && brand.competitors.length > 0) {
      for (const comp of brand.competitors.slice(0, 3)) {
        competitors.push({
          name: comp.name,
          description: comp.description,
          differentiator: comp.differentiator,
          strengths: [],
          weaknesses: [],
          socialPresence: {},
          influencerActivity: 'לא ידוע',
        });
      }
    }

    return competitors;
  }

  private analyzeSocialPresence(
    brand: BrandResearch,
    _website?: Awaited<ReturnType<typeof scrapeWebsite>>
  ): SocialAnalysis {
    const analysis: SocialAnalysis = {
      platforms: [],
      overallScore: 0,
      recommendations: [],
    };

    // Check Instagram
    if (brand.socialPresence?.instagram) {
      const ig = brand.socialPresence.instagram;
      analysis.platforms.push({
        name: 'Instagram',
        handle: ig.handle || 'לא ידוע',
        followers: ig.followers || 'לא ידוע',
        engagement: ig.engagement || 'לא ידוע',
        score: this.calculatePlatformScore(ig),
      });
    } else {
      analysis.recommendations.push('פתיחת חשבון אינסטגרם');
    }

    // Check TikTok
    if (brand.socialPresence?.tiktok) {
      const tt = brand.socialPresence.tiktok;
      analysis.platforms.push({
        name: 'TikTok',
        handle: tt.handle || 'לא ידוע',
        followers: tt.followers || 'לא ידוע',
        engagement: 'לא ידוע',
        score: 50,
      });
    } else {
      analysis.recommendations.push('כניסה לטיקטוק');
    }

    // Check Facebook
    if (brand.socialPresence?.facebook) {
      const fb = brand.socialPresence.facebook;
      analysis.platforms.push({
        name: 'Facebook',
        handle: 'לא ידוע',
        followers: fb.followers || 'לא ידוע',
        engagement: fb.engagement || 'לא ידוע',
        score: 40,
      });
    }

    // Calculate overall score
    if (analysis.platforms.length > 0) {
      analysis.overallScore = Math.round(
        analysis.platforms.reduce((sum, p) => sum + p.score, 0) / analysis.platforms.length
      );
    }

    return analysis;
  }

  private calculatePlatformScore(platform: any): number {
    let score = 50;
    
    if (platform.followers) {
      const followers = parseInt(platform.followers.replace(/[^0-9]/g, '')) || 0;
      if (followers > 100000) score += 30;
      else if (followers > 10000) score += 20;
      else if (followers > 1000) score += 10;
    }

    if (platform.engagement) {
      const engagement = parseFloat(platform.engagement) || 0;
      if (engagement > 5) score += 20;
      else if (engagement > 3) score += 10;
      else if (engagement > 1) score += 5;
    }

    return Math.min(100, score);
  }

  private formatResearchReport(
    brand: BrandResearch,
    competitors: CompetitorResearch[],
    social: SocialAnalysis,
    website?: any
  ): string {
    const lines: string[] = [
      `# 📊 מחקר עומק: ${brand.brandName}`,
      '',
      '---',
      '',
      '## 1. סקירת המותג',
      '',
      brand.companyDescription,
      '',
      `**תעשייה:** ${brand.industry}`,
      `**מיקום בשוק:** ${brand.marketPosition}`,
      `**תמחור:** ${brand.pricePositioning}`,
      '',
    ];

    // USPs
    if (brand.uniqueSellingPoints && brand.uniqueSellingPoints.length > 0) {
      lines.push('### נקודות חוזק');
      lines.push(...brand.uniqueSellingPoints.map(u => `- ${u}`));
      lines.push('');
    }

    // Target audience
    lines.push('## 2. קהל יעד');
    lines.push('');
    if (brand.targetDemographics?.primaryAudience) {
      const ta = brand.targetDemographics.primaryAudience;
      lines.push(`- **מגדר:** ${ta.gender}`);
      lines.push(`- **גילאים:** ${ta.ageRange}`);
      lines.push(`- **רמה סוציו-אקונומית:** ${ta.socioeconomic}`);
      lines.push(`- **סגנון חיים:** ${ta.lifestyle}`);
    }
    lines.push('');

    // Competitors
    lines.push('## 3. ניתוח מתחרים');
    lines.push('');
    if (competitors.length > 0) {
      for (const comp of competitors) {
        lines.push(`### ${comp.name}`);
        lines.push(comp.description);
        lines.push(`**מבדל:** ${comp.differentiator}`);
        lines.push('');
      }
    } else if (brand.competitors && brand.competitors.length > 0) {
      for (const comp of brand.competitors) {
        lines.push(`### ${comp.name}`);
        lines.push(comp.description);
        lines.push(`**מבדל:** ${comp.differentiator}`);
        lines.push('');
      }
    } else {
      lines.push('לא נמצאו מתחרים ישירים');
      lines.push('');
    }

    // Social Analysis
    lines.push('## 4. נוכחות דיגיטלית');
    lines.push('');
    lines.push(`**ציון כללי:** ${social.overallScore}/100`);
    lines.push('');
    
    if (social.platforms.length > 0) {
      lines.push('| פלטפורמה | עוקבים | מעורבות | ציון |');
      lines.push('|----------|--------|---------|------|');
      for (const p of social.platforms) {
        lines.push(`| ${p.name} | ${p.followers} | ${p.engagement} | ${p.score} |`);
      }
      lines.push('');
    }

    if (social.recommendations.length > 0) {
      lines.push('### המלצות');
      lines.push(...social.recommendations.map(r => `- ${r}`));
      lines.push('');
    }

    // Website analysis
    if (website) {
      lines.push('## 5. ניתוח אתר');
      lines.push('');
      lines.push(`**כותרת:** ${website.title}`);
      lines.push(`**תיאור:** ${website.description}`);
      if (website.primaryColor) {
        lines.push(`**צבע ראשי:** ${website.primaryColor}`);
      }
      lines.push('');
    }

    // Previous campaigns
    if (brand.previousCampaigns && brand.previousCampaigns.length > 0) {
      lines.push('## 6. קמפיינים קודמים');
      lines.push('');
      for (const camp of brand.previousCampaigns) {
        lines.push(`### ${camp.name}`);
        lines.push(camp.description);
        if (camp.results) lines.push(`**תוצאות:** ${camp.results}`);
        lines.push('');
      }
    }

    // Recommendations
    lines.push('---');
    lines.push('');
    lines.push('## 💡 המלצות');
    lines.push('');
    lines.push(`**גישה מומלצת:** ${brand.suggestedApproach}`);
    lines.push('');
    if (brand.recommendedGoals && brand.recommendedGoals.length > 0) {
      lines.push('**מטרות מומלצות:**');
      lines.push(...brand.recommendedGoals.map(g => `- ${g}`));
    }
    lines.push('');
    
    if (brand.potentialChallenges && brand.potentialChallenges.length > 0) {
      lines.push('**אתגרים פוטנציאליים:**');
      lines.push(...brand.potentialChallenges.map(c => `- ${c}`));
    }

    lines.push('');
    lines.push('---');
    lines.push(`*רמת ביטחון: ${brand.confidence}*`);

    return lines.join('\n');
  }
}

interface CompetitorResearch {
  name: string;
  description: string;
  differentiator: string;
  strengths: string[];
  weaknesses: string[];
  socialPresence: Record<string, any>;
  influencerActivity: string;
}

interface SocialAnalysis {
  platforms: {
    name: string;
    handle: string;
    followers: string;
    engagement: string;
    score: number;
  }[];
  overallScore: number;
  recommendations: string[];
}
