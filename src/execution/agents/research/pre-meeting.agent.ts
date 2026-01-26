/**
 * Pre-Meeting Brand Research Agent
 * Agent #2 from the Multi-Agent System table
 * 
 * Uses GROUNDING (Search) to:
 * 1. Research company and contact person
 * 2. Find recent news/PR
 * 3. Identify business challenges from interviews/articles
 * 4. Detect organizational changes
 * Output: "Cheat Sheet" for sales meeting
 */

import { BaseAgent } from '../../base-agent.js';
import { researchBrand, type BrandResearch } from '../../../knowledge/brand-research.js';
import { scrapeWebsite } from '../../../integrations/apify/scraper.js';
import type { Job, AgentResult, Intent } from '../../../types/index.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

// Services that Leaders offers
const LEADERS_SERVICES = [
  { name: 'שיווק משפיענים', category: 'influencers' },
  { name: 'קריאייטיב ותוכן', category: 'creative' },
  { name: 'אסטרטגיית סושיאל', category: 'social' },
  { name: 'מדיה ממומנת', category: 'paid' },
  { name: 'הפקות תוכן', category: 'production' },
  { name: 'ייעוץ מותגי', category: 'branding' },
];

export class PreMeetingResearchAgent extends BaseAgent {
  id = 'research/pre-meeting';
  name = 'Pre-Meeting Brand Research';
  nameHebrew = 'מחקר מקדים לפגישה';
  layer = 2 as const;
  domain = 'research';
  description = 'מבצע מחקר מקדים על מותג לפני פגישה, מזהה פערים ומתאים שירותי Leadrs';
  capabilities = [
    'brand-research',
    'competitor-analysis',
    'gap-identification',
    'meeting-preparation',
  ];
  
  // Agent #2 - Uses GROUNDING (Google Search)
  protected geminiTools: GeminiTool[] = ['grounding'];

  canHandle(intent: Intent): boolean {
    if (intent.primary === 'research_brand') return true;
    if (intent.primary === 'prepare_meeting') return true;
    return false;
  }

  async execute(job: Job): Promise<AgentResult> {
    const jobLog = this.log.child({ jobId: job.id });
    jobLog.info('Starting pre-meeting research with Grounding');

    try {
      // Extract company name and contact person
      const brandName = this.extractBrandName(job.rawInput);
      const contactPerson = this.extractContactPerson(job.rawInput);
      
      if (!brandName) {
        return this.failure('לא צוין שם מותג. אנא ציין את שם המותג למחקר.');
      }

      // Step 1: Website scraping (if URL provided)
      let websiteData: Awaited<ReturnType<typeof scrapeWebsite>> | undefined;
      const websiteUrl = this.extractWebsiteUrl(job.rawInput);
      
      if (websiteUrl) {
        jobLog.info('Scraping website', { url: websiteUrl });
        try {
          websiteData = await scrapeWebsite(websiteUrl);
        } catch (error) {
          jobLog.warn('Website scrape failed', { error });
        }
      }

      // Step 2: Deep Research with Grounding (Google Search - Gemini Tool)
      jobLog.info('Performing deep research with Gemini Grounding', { brand: brandName, contact: contactPerson });
      
      // Use Gemini Grounding tool for real-time search
      const searchQuery = `${brandName} company Israel ${contactPerson || ''} news recent`;
      const groundingResult = await this.searchWeb(searchQuery);
      
      // Build context from grounding results
      let groundedResearch = groundingResult.text;
      
      // Add sources if available
      if (groundingResult.groundingMetadata?.sources) {
        groundedResearch += '\n\n### מקורות שנמצאו:\n';
        for (const source of groundingResult.groundingMetadata.sources.slice(0, 5)) {
          groundedResearch += `- [${source.title}](${source.uri})\n`;
        }
      }
      
      // Additional detailed search if contact person provided
      if (contactPerson) {
        jobLog.info('Searching for contact person info');
        const contactResult = await this.searchWeb(`${contactPerson} ${brandName} LinkedIn`);
        groundedResearch += '\n\n### מידע על איש הקשר:\n' + contactResult.text;
      }

      // Step 3: Brand research for structured data
      const brandResearch = await researchBrand(brandName, websiteData ? {
        url: websiteData.url,
        title: websiteData.title,
        description: websiteData.description,
        headings: [...websiteData.headings.h1, ...websiteData.headings.h2],
        paragraphs: websiteData.paragraphs,
        socialLinks: Object.values(websiteData.socialLinks).filter(Boolean) as string[],
      } : undefined);

      // Step 4: Identify gaps
      const gaps = this.identifyGaps(brandResearch, websiteData);

      // Step 5: Match with Leaders services
      const opportunities = this.matchServicesWithGaps(gaps, brandResearch);

      // Format output as Cheat Sheet
      const output = this.formatCheatSheet(brandResearch, groundedResearch, gaps, opportunities, contactPerson);

      return this.success(output, {
        structured: {
          brandResearch,
          websiteData,
          gaps,
          opportunities,
          contactPerson,
        },
        citations: this.mapSourcesToCitations(brandResearch.sources || []),
        confidence: brandResearch.confidence,
      });
    } catch (error) {
      jobLog.error('Pre-meeting research failed', error as Error);
      return this.failure('אירעה שגיאה במחקר. אנא נסה שוב.');
    }
  }

  private extractContactPerson(input: string): string | undefined {
    const patterns = [
      /(?:איש קשר|פגישה עם|לדבר עם|להיפגש עם)\s+["']?([א-תA-Za-z\s]+)["']?/,
      /(?:linkedin|לינקדאין).*?([א-תA-Za-z\s]+)/i,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  private formatCheatSheet(
    brand: BrandResearch,
    groundedResearch: string,
    gaps: { category: string; gap: string; severity: string; explanation: string }[],
    opportunities: { service: string; relevance: string; reason: string }[],
    contactPerson?: string
  ): string {
    const lines: string[] = [
      `# 📋 Cheat Sheet: פגישה עם ${brand.brandName}`,
      '',
      '---',
      '',
    ];

    // Contact person section
    if (contactPerson) {
      lines.push(`## 👤 איש קשר: ${contactPerson}`);
      lines.push('');
    }

    // Grounded research (recent info)
    lines.push('## 🔍 מידע עדכני (מחיפוש)');
    lines.push('');
    lines.push(groundedResearch);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Quick facts
    lines.push('## ⚡ עובדות מהירות');
    lines.push(`- **תעשייה:** ${brand.industry}`);
    lines.push(`- **מיקום:** ${brand.headquarters}`);
    lines.push(`- **מיצוב:** ${brand.marketPosition}`);
    if (brand.socialPresence?.instagram?.handle) {
      lines.push(`- **אינסטגרם:** @${brand.socialPresence.instagram.handle}`);
    }
    lines.push('');

    // Opportunities
    const highOpp = opportunities.filter(o => o.relevance === 'high').slice(0, 3);
    if (highOpp.length > 0) {
      lines.push('## 💡 הזדמנויות מרכזיות');
      for (const opp of highOpp) {
        lines.push(`- **${opp.service}:** ${opp.reason}`);
      }
      lines.push('');
    }

    // Gaps to address
    const criticalGaps = gaps.filter(g => g.severity === 'high').slice(0, 3);
    if (criticalGaps.length > 0) {
      lines.push('## 🎯 נקודות כאב להתייחס');
      for (const gap of criticalGaps) {
        lines.push(`- ${gap.gap}`);
      }
      lines.push('');
    }

    // Meeting tips
    lines.push('## 💬 טיפים לפגישה');
    lines.push('- התחל בשאלה פתוחה על האתגרים הנוכחיים');
    lines.push('- הזכר מידע עדכני שמצאת (חדשות, שינויים)');
    lines.push('- התמקד בתוצאות ו-ROI');
    lines.push('');

    lines.push('---');
    lines.push(`*רמת ביטחון: ${brand.confidence}*`);

    return lines.join('\n');
  }

  private extractBrandName(input: string): string | undefined {
    const patterns = [
      /(?:מותג|לקוח|על|חקור|מחקר)\s+["']?([א-תA-Za-z0-9\s]+)["']?/,
      /פגישה\s+עם\s+["']?([א-תA-Za-z0-9\s]+)["']?/,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    // Fallback: take first capitalized word or Hebrew word
    const words = input.split(/\s+/);
    for (const word of words) {
      if (/^[A-Z]/.test(word) || /^[א-ת]/.test(word)) {
        return word;
      }
    }

    return undefined;
  }

  private extractWebsiteUrl(input: string): string | undefined {
    const urlPattern = /https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(?:com|co\.il|io|net|org)/gi;
    const match = input.match(urlPattern);
    return match ? match[0] : undefined;
  }

  private identifyGaps(
    brand: BrandResearch,
    website?: Awaited<ReturnType<typeof scrapeWebsite>>
  ): {
    category: string;
    gap: string;
    severity: 'high' | 'medium' | 'low';
    explanation: string;
  }[] {
    const gaps: {
      category: string;
      gap: string;
      severity: 'high' | 'medium' | 'low';
      explanation: string;
    }[] = [];

    // Social presence gaps
    if (!brand.socialPresence?.instagram?.handle) {
      gaps.push({
        category: 'social',
        gap: 'חוסר נוכחות באינסטגרם',
        severity: 'high',
        explanation: 'אינסטגרם הוא פלטפורמה קריטית לחשיפה ומעורבות',
      });
    } else if (brand.socialPresence?.instagram?.engagement && 
               parseFloat(brand.socialPresence.instagram.engagement) < 2) {
      gaps.push({
        category: 'social',
        gap: 'מעורבות נמוכה באינסטגרם',
        severity: 'medium',
        explanation: 'אחוז מעורבות מתחת לממוצע בתעשייה',
      });
    }

    if (!brand.socialPresence?.tiktok?.handle) {
      gaps.push({
        category: 'social',
        gap: 'חוסר נוכחות בטיקטוק',
        severity: 'medium',
        explanation: 'טיקטוק הוא פלטפורמה צומחת לקהלים צעירים',
      });
    }

    // Influencer marketing gaps
    if (!brand.previousCampaigns || brand.previousCampaigns.length === 0) {
      gaps.push({
        category: 'influencers',
        gap: 'אין היסטוריה של קמפיינים עם משפיענים',
        severity: 'high',
        explanation: 'שיווק משפיענים יכול להגדיל חשיפה באופן משמעותי',
      });
    }

    // Content gaps
    if (website && website.paragraphs.length < 5) {
      gaps.push({
        category: 'content',
        gap: 'תוכן מועט באתר',
        severity: 'medium',
        explanation: 'אתר עם תוכן עשיר משפר SEO ואמינות',
      });
    }

    // Visual identity gaps
    if (website && !website.primaryColor) {
      gaps.push({
        category: 'branding',
        gap: 'זהות ויזואלית לא ברורה',
        severity: 'low',
        explanation: 'חוסר עקביות בצבעים ומיתוג',
      });
    }

    // Competitor gaps
    if (brand.competitors && brand.competitors.length > 0) {
      const strongerCompetitors = brand.competitors.filter(c => 
        c.description.toLowerCase().includes('מוביל') || 
        c.description.toLowerCase().includes('גדול')
      );
      if (strongerCompetitors.length > 0) {
        gaps.push({
          category: 'competition',
          gap: 'מתחרים חזקים יותר בשוק',
          severity: 'medium',
          explanation: `מתחרים: ${strongerCompetitors.map(c => c.name).join(', ')}`,
        });
      }
    }

    return gaps;
  }

  private mapSourcesToCitations(sources: { title: string; url: string }[]): { source: string; content: string; documentId: string }[] {
    return sources.map((s, i) => ({
      source: s.url,
      content: s.title,
      documentId: `source-${i}`,
    }));
  }

  private matchServicesWithGaps(
    gaps: { category: string; gap: string; severity: string; explanation: string }[],
    _brand: BrandResearch
  ): {
    service: string;
    relevance: 'high' | 'medium' | 'low';
    reason: string;
  }[] {
    const opportunities: {
      service: string;
      relevance: 'high' | 'medium' | 'low';
      reason: string;
    }[] = [];

    for (const gap of gaps) {
      const matchingServices = LEADERS_SERVICES.filter(s => s.category === gap.category);
      for (const service of matchingServices) {
        opportunities.push({
          service: service.name,
          relevance: gap.severity as 'high' | 'medium' | 'low',
          reason: gap.gap,
        });
      }
    }

    // Add default recommendation if no influencer campaigns
    if (!opportunities.find(o => o.service === 'שיווק משפיענים')) {
      opportunities.push({
        service: 'שיווק משפיענים',
        relevance: 'high',
        reason: 'כל מותג יכול להרוויח משיווק משפיענים',
      });
    }

    return opportunities;
  }

  private formatResearchOutput(
    brand: BrandResearch,
    gaps: { category: string; gap: string; severity: string; explanation: string }[],
    opportunities: { service: string; relevance: string; reason: string }[]
  ): string {
    const lines: string[] = [
      `# מחקר מקדים: ${brand.brandName}`,
      '',
      '## סקירת המותג',
      brand.companyDescription,
      '',
      '---',
      '',
      '## פרטים בסיסיים',
      `- **תעשייה:** ${brand.industry}`,
      `- **הוקם:** ${brand.founded}`,
      `- **מיקום:** ${brand.headquarters}`,
      `- **אתר:** ${brand.website || 'לא נמצא'}`,
      '',
      '## קהל יעד',
      `- **מגדר:** ${brand.targetDemographics?.primaryAudience?.gender || 'לא ידוע'}`,
      `- **גילאים:** ${brand.targetDemographics?.primaryAudience?.ageRange || 'לא ידוע'}`,
      `- **סגנון חיים:** ${brand.targetDemographics?.primaryAudience?.lifestyle || 'לא ידוע'}`,
      '',
      '## נוכחות דיגיטלית',
    ];

    if (brand.socialPresence?.instagram?.handle) {
      lines.push(`- **אינסטגרם:** @${brand.socialPresence.instagram.handle} (${brand.socialPresence.instagram.followers || '?'} עוקבים)`);
    }
    if (brand.socialPresence?.tiktok?.handle) {
      lines.push(`- **טיקטוק:** @${brand.socialPresence.tiktok.handle}`);
    }
    if (brand.socialPresence?.facebook?.followers) {
      lines.push(`- **פייסבוק:** ${brand.socialPresence.facebook.followers} עוקבים`);
    }

    lines.push('');
    lines.push('## מתחרים');
    if (brand.competitors && brand.competitors.length > 0) {
      for (const comp of brand.competitors.slice(0, 3)) {
        lines.push(`- **${comp.name}:** ${comp.differentiator}`);
      }
    } else {
      lines.push('לא נמצאו מתחרים ישירים');
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 🔴 פערים וחוסרים');
    
    const highGaps = gaps.filter(g => g.severity === 'high');
    const mediumGaps = gaps.filter(g => g.severity === 'medium');
    
    if (highGaps.length > 0) {
      lines.push('### חמורים');
      for (const gap of highGaps) {
        lines.push(`- **${gap.gap}** - ${gap.explanation}`);
      }
    }
    
    if (mediumGaps.length > 0) {
      lines.push('### בינוניים');
      for (const gap of mediumGaps) {
        lines.push(`- **${gap.gap}** - ${gap.explanation}`);
      }
    }

    lines.push('');
    lines.push('## 💡 הזדמנויות לשירותי Leadrs');
    
    const highOpp = opportunities.filter(o => o.relevance === 'high');
    const mediumOpp = opportunities.filter(o => o.relevance === 'medium');
    
    for (const opp of [...highOpp, ...mediumOpp].slice(0, 5)) {
      const icon = opp.relevance === 'high' ? '⭐' : '•';
      lines.push(`${icon} **${opp.service}** - ${opp.reason}`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(`*רמת ביטחון במחקר: ${brand.confidence}*`);
    
    if (brand.sources && brand.sources.length > 0) {
      lines.push('');
      lines.push('**מקורות:**');
      for (const source of brand.sources.slice(0, 3)) {
        lines.push(`- [${source.title}](${source.url})`);
      }
    }

    return lines.join('\n');
  }
}
