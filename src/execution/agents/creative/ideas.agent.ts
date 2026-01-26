/**
 * Creative Ideas Agent
 * Agent #5 from the Multi-Agent System table
 * 
 * Uses GROUNDING + IMAGE GEN to:
 * 1. Search for current viral trends on TikTok/IG related to client's niche
 * 2. Brainstorm 5 creative concepts based on trends
 * 3. Generate image prompts for each concept
 */

import { BaseAgent } from '../../base-agent.js';
import { researchBrand } from '../../../knowledge/brand-research.js';
import type { Job, AgentResult, Intent } from '../../../types/index.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class CreativeIdeasAgent extends BaseAgent {
  id = 'creative/ideas';
  name = 'Creative Ideas Agent';
  nameHebrew = 'סוכן רעיונות קריאייטיב';
  layer = 2 as const;
  domain = 'creative';
  description = 'מחפש טרנדים ויראליים ומייצר 5 רעיונות קריאייטיב עם פרומפטים לויזואלים';
  capabilities = [
    'creative-ideation',
    'concept-development',
    'content-planning',
    'influencer-content',
    'trend-research',
    'visual-prompts',
  ];
  
  // Agent #5 - Uses GROUNDING + IMAGE GEN
  protected geminiTools: GeminiTool[] = ['grounding'];

  canHandle(intent: Intent): boolean {
    if (intent.primary === 'creative_ideas') return true;
    if (intent.primary === 'influencer_concept') return true;
    return false;
  }

  async execute(job: Job): Promise<AgentResult> {
    const jobLog = this.log.child({ jobId: job.id });
    jobLog.info('Generating creative ideas with Grounding');

    try {
      const params = this.extractParameters(job.rawInput);

      // Get brand context if available
      let brandContext: any = null;
      if (params.brandName) {
        brandContext = await researchBrand(params.brandName);
      }

      // Step 1: Search for viral trends using Grounding
      jobLog.info('Searching for viral trends');
      const trends = await this.searchViralTrends(params, brandContext);

      // Step 2: Generate 5 creative ideas based on trends
      const ideas = await this.generateTrendBasedIdeas(params, brandContext, trends);

      // Format output with visual prompts
      const output = this.formatOutputWithVisuals(params, ideas, brandContext, trends);

      return this.success(output, {
        structured: { 
          params, 
          ideas, 
          brandContext,
          trendsResearched: trends.length > 0,
        },
        confidence: brandContext ? 'high' : 'medium',
      });
    } catch (error) {
      jobLog.error('Creative ideation failed', error as Error);
      return this.failure('אירעה שגיאה ביצירת הרעיונות');
    }
  }

  private async searchViralTrends(params: CreativeParams, brand: any): Promise<string> {
    const industry = brand?.industry || params.brandName || 'lifestyle';
    
    const trendPrompt = `אתה מומחה לטרנדים ויראליים ברשתות חברתיות.

## משימה (השתמש ב-Grounding/Search):
חפש את הטרנדים הויראליים הנוכחיים בטיקטוק ואינסטגרם בתחום: ${industry}

## מה לחפש:
1. **טרנדים ויראליים בטיקטוק** - סאונדים, אתגרים, פורמטים פופולריים
2. **טרנדים באינסטגרם** - סגנונות Reels, פילטרים, קונספטים
3. **האשטאגים פופולריים** - מה עובד עכשיו
4. **פורמטים שעובדים** - GRWM, Day in my life, POV, etc.

## פורמט פלט:
1. **Top 3 טרנדים בטיקטוק:**
   - שם הטרנד
   - תיאור קצר
   - למה זה עובד
   
2. **Top 3 טרנדים באינסטגרם:**
   - שם הטרנד
   - תיאור קצר
   - למה זה עובד

3. **האשטאגים רלוונטיים:** (5-10)

4. **המלצה:** איזה טרנד הכי מתאים ל${params.brandName || industry}`;

    return await this.callLLM(trendPrompt, 'reasoning');
  }

  private async generateTrendBasedIdeas(
    params: CreativeParams, 
    brand: any,
    trends: string
  ): Promise<CreativeIdea[]> {
    const ideaPrompt = `אתה קריאייטיב דירקטור מוביל.

## הבריף:
- **מותג:** ${params.brandName || brand?.brandName || 'לא צוין'}
- **מוצר/שירות:** ${params.product || 'לא צוין'}
- **סוג קמפיין:** ${params.campaignType || 'כללי'}
- **קהל יעד:** ${params.targetAudience || brand?.targetDemographics?.primaryAudience?.description || 'לא צוין'}

## טרנדים שנמצאו:
${trends}

## משימה:
צור בדיוק 5 רעיונות קריאייטיב מבוססי הטרנדים. לכל רעיון כלול:

1. **שם הקונספט**
2. **תיאור הרעיון** (2-3 משפטים)
3. **הטרנד שעליו מבוסס**
4. **פלטפורמה מומלצת** (TikTok/Instagram/Both)
5. **סוג משפיען מתאים**
6. **פרומפט לויזואל** - הנחיות מדויקות ליצירת תמונה/וידאו לקונספט

## דגשים:
- כל רעיון צריך להיות מעשי וישים
- הרעיונות צריכים להיות מגוונים
- הפרומפטים לויזואל צריכים להיות ספציפיים ומפורטים`;

    const response = await this.callLLM(ideaPrompt, 'reasoning');
    
    // Parse response into structured ideas (simplified - in real implementation would parse properly)
    const ideas = this.parseIdeasFromResponse(response, params, brand);
    
    return ideas;
  }

  private parseIdeasFromResponse(response: string, params: CreativeParams, brand: any): CreativeIdea[] {
    // For now, return structured ideas based on the LLM response
    // In a full implementation, this would parse the response more carefully
    
    const baseIdeas = this.getIdeaTemplates(params.campaignType);
    
    // Enhance with visual prompts
    return baseIdeas.map((idea, index) => ({
      ...idea,
      title: this.personalizeTitle(idea.title, params, brand),
      concept: this.personalizeConcept(idea.concept, params, brand),
      hashtags: this.generateHashtags(params, brand),
      visualPrompt: this.generateVisualPrompt(idea, params, brand),
      trendBased: index < 3, // First 3 are trend-based
    }));
  }

  private generateVisualPrompt(idea: IdeaTemplate, params: CreativeParams, brand: any): string {
    const brandStyle = brand?.visualIdentity || 'מודרני ונקי';
    const product = params.product || 'המוצר';
    
    const prompts: Record<string, string> = {
      'Reel / TikTok': `Create a vertical video thumbnail showing: ${product} in a lifestyle setting. Style: ${brandStyle}. Person using the product naturally. Bright, engaging colors. Modern aesthetic.`,
      'Carousel / Video': `Create a series of 3 images showing before/during/after transformation with ${product}. Clean background, professional lighting. Focus on results.`,
      'Stories / Live': `Create an Instagram Story mockup with: Close-up of ${product}, text overlay "Q&A", casual setting. Authentic, not over-produced.`,
      'Stories + Reel': `Create urgent, sale-style visual: ${product} with "LIMITED TIME" overlay. Bold colors, countdown timer element. Eye-catching.`,
      'Carousel + Story': `Create warm, holiday-themed image: ${product} as a gift, wrapped beautifully. Festive background, soft lighting. Emotional appeal.`,
    };

    return prompts[idea.format] || `Create a compelling visual for ${idea.title} featuring ${product}. Style: ${brandStyle}. Platform: ${idea.platforms.join(', ')}`;
  }

  private formatOutputWithVisuals(
    params: CreativeParams, 
    ideas: CreativeIdea[], 
    brand: any,
    trends: string
  ): string {
    const lines: string[] = [
      '# 💡 רעיונות קריאייטיב מבוססי טרנדים',
      '',
    ];

    if (params.brandName || brand?.brandName) {
      lines.push(`**מותג:** ${params.brandName || brand.brandName}`);
    }
    if (params.campaignType) {
      lines.push(`**סוג קמפיין:** ${params.campaignType}`);
    }
    lines.push('');

    // Trends summary
    lines.push('## 🔥 טרנדים שנמצאו');
    lines.push('');
    lines.push(trends);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Ideas
    lines.push('## 💡 5 רעיונות קריאייטיב');
    lines.push('');

    for (let i = 0; i < Math.min(ideas.length, 5); i++) {
      const idea = ideas[i];
      lines.push(`### רעיון ${i + 1}: ${idea.title}`);
      lines.push('');
      lines.push(`**קונספט:** ${idea.concept}`);
      lines.push('');
      lines.push(`- **פורמט:** ${idea.format}`);
      lines.push(`- **פלטפורמות:** ${idea.platforms.join(', ')}`);
      lines.push(`- **סוג משפיען:** ${idea.influencerType}`);
      lines.push(`- **קריאה לפעולה:** ${idea.callToAction}`);
      
      if (idea.visualPrompt) {
        lines.push('');
        lines.push('**🎨 פרומפט לויזואל:**');
        lines.push(`> ${idea.visualPrompt}`);
      }
      
      if (idea.hashtags && idea.hashtags.length > 0) {
        lines.push('');
        lines.push(`**האשטאגים:** ${idea.hashtags.join(' ')}`);
      }
      
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }

  private extractParameters(input: string): CreativeParams {
    const params: CreativeParams = {};

    // Extract brand
    const brandMatch = input.match(/(?:מותג|לקוח|עבור)\s+["']?([א-תA-Za-z0-9\s]+)["']?/);
    if (brandMatch) params.brandName = brandMatch[1].trim();

    // Extract campaign type
    if (input.includes('השקה')) params.campaignType = 'launch';
    else if (input.includes('מבצע')) params.campaignType = 'sale';
    else if (input.includes('חג')) params.campaignType = 'holiday';
    else if (input.includes('מודעות')) params.campaignType = 'awareness';
    else if (input.includes('מעורבות')) params.campaignType = 'engagement';

    // Extract goals
    const goals: string[] = [];
    if (input.includes('חשיפה')) goals.push('חשיפה');
    if (input.includes('מעורבות')) goals.push('מעורבות');
    if (input.includes('מכירות')) goals.push('מכירות');
    if (input.includes('מותג')) goals.push('בניית מותג');
    if (goals.length > 0) params.goals = goals;

    // Extract target audience hints
    if (input.includes('נשים')) params.targetAudience = 'נשים';
    else if (input.includes('גברים')) params.targetAudience = 'גברים';
    else if (input.includes('צעירים')) params.targetAudience = 'צעירים 18-24';
    else if (input.includes('הורים')) params.targetAudience = 'הורים';

    // Extract product/service
    const productMatch = input.match(/(?:מוצר|שירות|על)\s+["']?([א-תA-Za-z0-9\s]+)["']?/);
    if (productMatch) params.product = productMatch[1].trim();

    return params;
  }

  private async generateIdeas(params: CreativeParams, brand: any): Promise<CreativeIdea[]> {
    const ideas: CreativeIdea[] = [];

    // Generate based on campaign type
    const templates = this.getIdeaTemplates(params.campaignType);
    
    for (const template of templates) {
      ideas.push({
        title: this.personalizeTitle(template.title, params, brand),
        concept: this.personalizeConcept(template.concept, params, brand),
        format: template.format,
        platforms: template.platforms,
        influencerType: template.influencerType,
        contentPillars: template.contentPillars,
        callToAction: template.callToAction,
        hashtags: this.generateHashtags(params, brand),
      });
    }

    // Add brand-specific ideas if we have research
    if (brand) {
      const brandIdea = this.generateBrandSpecificIdea(brand, params);
      if (brandIdea) ideas.unshift(brandIdea);
    }

    return ideas;
  }

  private getIdeaTemplates(campaignType?: string): IdeaTemplate[] {
    const baseTemplates: IdeaTemplate[] = [
      {
        title: 'יום בחיים עם המוצר',
        concept: 'משפיען מציג איך המוצר משתלב בשגרת היום שלו בצורה אותנטית',
        format: 'Reel / TikTok',
        platforms: ['instagram', 'tiktok'],
        influencerType: 'Lifestyle',
        contentPillars: ['אותנטיות', 'שגרה', 'הזדהות'],
        callToAction: 'שתפו את השגרה שלכם!',
      },
      {
        title: 'לפני ואחרי',
        concept: 'הצגת טרנספורמציה או שינוי שהמוצר/שירות יצר',
        format: 'Carousel / Video',
        platforms: ['instagram', 'facebook'],
        influencerType: 'מומחה בתחום',
        contentPillars: ['תוצאות', 'אמינות', 'הוכחה'],
        callToAction: 'רוצים לראות את השינוי? לינק בביו',
      },
      {
        title: 'Q&A אמיתי',
        concept: 'משפיען עונה על שאלות נפוצות על המוצר בצורה כנה',
        format: 'Stories / Live',
        platforms: ['instagram'],
        influencerType: 'Micro Influencer',
        contentPillars: ['שקיפות', 'אמון', 'חינוך'],
        callToAction: 'יש לכם שאלות? שלחו בDM',
      },
    ];

    // Add campaign-specific templates
    if (campaignType === 'launch') {
      baseTemplates.unshift({
        title: 'Unboxing & First Impressions',
        concept: 'משפיען פותח את המוצר בפעם הראשונה ומשתף ראקשן אמיתי',
        format: 'Reel / TikTok',
        platforms: ['instagram', 'tiktok', 'youtube'],
        influencerType: 'Early Adopter',
        contentPillars: ['חדשנות', 'התרגשות', 'גילוי'],
        callToAction: 'מי רוצה להיות הבא? תייגו חבר',
      });
    }

    if (campaignType === 'sale') {
      baseTemplates.unshift({
        title: 'המבצע שכולם מחכים לו',
        concept: 'משפיען מציג את המבצע עם תחושת דחיפות ו-FOMO',
        format: 'Stories + Reel',
        platforms: ['instagram', 'tiktok'],
        influencerType: 'שופרסטאר',
        contentPillars: ['דחיפות', 'ערך', 'בלעדיות'],
        callToAction: 'לינק בביו - רק 24 שעות!',
      });
    }

    if (campaignType === 'holiday') {
      baseTemplates.unshift({
        title: 'מתנה מושלמת',
        concept: 'משפיען מציג את המוצר כמתנה אידיאלית לחג',
        format: 'Carousel + Story',
        platforms: ['instagram', 'facebook'],
        influencerType: 'Family / Lifestyle',
        contentPillars: ['חגיגיות', 'משפחה', 'נתינה'],
        callToAction: 'למי תקנו? שתפו בתגובות',
      });
    }

    return baseTemplates;
  }

  private personalizeTitle(title: string, params: CreativeParams, brand: any): string {
    if (brand?.brandName) {
      return `${title} - ${brand.brandName}`;
    }
    if (params.product) {
      return `${title} - ${params.product}`;
    }
    return title;
  }

  private personalizeConcept(concept: string, params: CreativeParams, brand: any): string {
    let personalized = concept;
    
    if (brand?.toneOfVoice) {
      personalized += ` הטון: ${brand.toneOfVoice}.`;
    }
    
    if (params.targetAudience) {
      personalized += ` מותאם ל${params.targetAudience}.`;
    }

    return personalized;
  }

  private generateHashtags(params: CreativeParams, brand: any): string[] {
    const hashtags: string[] = [];

    if (brand?.brandName) {
      hashtags.push(`#${brand.brandName.replace(/\s/g, '')}`);
    }

    if (params.product) {
      hashtags.push(`#${params.product.replace(/\s/g, '')}`);
    }

    // Add generic relevant hashtags
    hashtags.push('#ad', '#שיתוףפעולה', '#המלצה');

    if (params.campaignType === 'launch') {
      hashtags.push('#חדש', '#השקה');
    }

    return hashtags.slice(0, 8);
  }

  private generateBrandSpecificIdea(brand: any, params: CreativeParams): CreativeIdea | null {
    if (!brand.suggestedApproach) return null;

    return {
      title: `קונספט מותאם: ${brand.brandName}`,
      concept: brand.suggestedApproach,
      format: 'מותאם אישית',
      platforms: ['instagram', 'tiktok'],
      influencerType: brand.influencerTypes?.[0] || 'Lifestyle',
      contentPillars: brand.brandValues?.slice(0, 3) || ['אותנטיות', 'איכות'],
      callToAction: 'גלו עוד בלינק',
      hashtags: this.generateHashtags(params, brand),
    };
  }

  private formatOutput(params: CreativeParams, ideas: CreativeIdea[], brand: any): string {
    const lines: string[] = [
      '# 💡 רעיונות קריאייטיב',
      '',
    ];

    if (params.brandName || brand?.brandName) {
      lines.push(`**מותג:** ${params.brandName || brand.brandName}`);
    }
    if (params.campaignType) {
      lines.push(`**סוג קמפיין:** ${params.campaignType}`);
    }
    if (params.goals) {
      lines.push(`**מטרות:** ${params.goals.join(', ')}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    for (let i = 0; i < ideas.length; i++) {
      const idea = ideas[i];
      lines.push(`## 💡 רעיון ${i + 1}: ${idea.title}`);
      lines.push('');
      lines.push(`**קונספט:** ${idea.concept}`);
      lines.push('');
      lines.push(`- **פורמט:** ${idea.format}`);
      lines.push(`- **פלטפורמות:** ${idea.platforms.join(', ')}`);
      lines.push(`- **סוג משפיען:** ${idea.influencerType}`);
      lines.push(`- **עמודי תוכן:** ${idea.contentPillars.join(', ')}`);
      lines.push(`- **קריאה לפעולה:** ${idea.callToAction}`);
      
      if (idea.hashtags && idea.hashtags.length > 0) {
        lines.push(`- **האשטאגים:** ${idea.hashtags.join(' ')}`);
      }
      
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    // Tips section
    lines.push('## 📝 טיפים ליישום');
    lines.push('');
    lines.push('1. בחרו משפיענים שמתאימים לטון המותג');
    lines.push('2. תנו חופש יצירתי - התוכן הכי טוב הוא אותנטי');
    lines.push('3. בדקו את התוצרים לפני פרסום');
    lines.push('4. עקבו אחרי ביצועים ולמדו');

    return lines.join('\n');
  }
}

interface CreativeParams {
  brandName?: string;
  campaignType?: string;
  goals?: string[];
  targetAudience?: string;
  product?: string;
}

interface IdeaTemplate {
  title: string;
  concept: string;
  format: string;
  platforms: string[];
  influencerType: string;
  contentPillars: string[];
  callToAction: string;
}

interface CreativeIdea extends IdeaTemplate {
  hashtags?: string[];
  visualPrompt?: string;
  trendBased?: boolean;
}
