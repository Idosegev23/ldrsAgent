/**
 * Influencer KPI Calculator Agent
 * Agent #4 from the Multi-Agent System table
 * 
 * Uses CODE EXECUTION (Python/pandas) to:
 * 1. Load raw CSV/Excel with campaign metrics
 * 2. Clean data
 * 3. Calculate custom KPIs (CPE = Cost / (Likes + Comments))
 * 4. Identify top performers
 * MANDATORY: Do not calculate manually - use Python code
 */

import { BaseAgent } from '../../base-agent.js';
import { calculateInfluencerKPIs, type CalculatedKPIs } from '../../../knowledge/influencer-research.js';
import type { Job, AgentResult, Intent } from '../../../types/index.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class InfluencerKPICalculatorAgent extends BaseAgent {
  id = 'influencers/kpi-calculator';
  name = 'Influencer KPI Calculator';
  nameHebrew = 'מחשבון KPI למשפיענים';
  layer = 2 as const;
  domain = 'influencers';
  description = 'מחשב KPI ו-CPE על בסיס דאטה של משפיענים, כמות ואופי תוצרים';
  capabilities = [
    'kpi-calculation',
    'cpe-calculation',
    'cpm-calculation',
    'roi-estimation',
  ];
  
  // Agent #4 - Uses CODE EXECUTION (Python/pandas)
  protected geminiTools: GeminiTool[] = ['code_execution'];

  canHandle(intent: Intent): boolean {
    if (intent.primary === 'influencer_kpi') return true;
    if (intent.entities.action === 'calculate' && intent.entities.domain === 'influencers') return true;
    return false;
  }

  async execute(job: Job): Promise<AgentResult> {
    const jobLog = this.log.child({ jobId: job.id });
    jobLog.info('Starting KPI calculation with Code Execution');

    try {
      // Check if CSV/Excel data is provided in knowledge pack
      const hasRawData = this.checkForRawData(job);
      
      // Extract campaign parameters
      const params = this.extractParameters(job.rawInput);

      if (!params.budget && !hasRawData) {
        return this.failure('לא צוין תקציב או נתונים. אנא ציין תקציב לחישוב או העלה קובץ CSV/Excel');
      }

      let kpis: CalculatedKPIs;
      let pythonAnalysis: string = '';

      if (hasRawData) {
        // Use Code Execution for raw data analysis (Gemini Tool)
        jobLog.info('Analyzing raw data with Gemini Code Execution');
        
        const dataContent = this.extractDataFromKnowledge(job);
        const codeTask = `נתח את נתוני קמפיין המשפיענים הבאים.
חשב:
- CPE (Cost Per Engagement) = Cost / (Likes + Comments)
- CPM (Cost Per Mille) = (Cost / Impressions) * 1000  
- Engagement Rate = (Likes + Comments) / Followers * 100
- זהה Top 3 Performers לפי CPE
- זהה משפיענים בעייתיים`;

        // Use Gemini Code Execution tool
        const codeResult = await this.executeCode(codeTask, dataContent);
        pythonAnalysis = codeResult.text;
        
        if (codeResult.codeExecutionResult?.output) {
          pythonAnalysis += '\n\n### תוצאות הקוד:\n' + codeResult.codeExecutionResult.output;
        }
        
        // Also calculate using our function for structured data
        kpis = calculateInfluencerKPIs({
          influencerCount: params.influencerCount || 5,
          deliverables: params.deliverables || [
            { type: 'רילים', count: 4 },
            { type: 'סטוריז', count: 12 },
          ],
          campaignDuration: params.campaignDuration || 30,
          budget: params.budget || 50000,
        });
      } else {
        // Calculate KPIs from parameters
        kpis = calculateInfluencerKPIs({
          influencerCount: params.influencerCount || 5,
          deliverables: params.deliverables || [
            { type: 'רילים', count: 4 },
            { type: 'סטוריז', count: 12 },
          ],
          campaignDuration: params.campaignDuration || 30,
          budget: params.budget!,
        });
      }

      // Generate benchmarks
      const benchmarks = this.generateBenchmarks(kpis, params.industry);

      // Format output
      const output = this.formatOutput(params, kpis, benchmarks, pythonAnalysis);

      return this.success(output, {
        structured: {
          params,
          kpis,
          benchmarks,
          hasRawData,
        },
        confidence: hasRawData ? 'high' : 'medium',
      });
    } catch (error) {
      jobLog.error('KPI calculation failed', error as Error);
      return this.failure('אירעה שגיאה בחישוב');
    }
  }

  private checkForRawData(job: Job): boolean {
    // Check knowledge pack for CSV/Excel data
    for (const chunk of job.knowledgePack.chunks) {
      if (chunk.source?.includes('.csv') || 
          chunk.source?.includes('.xlsx') ||
          chunk.content.includes('followers') ||
          chunk.content.includes('likes') ||
          chunk.content.includes('impressions')) {
        return true;
      }
    }
    return false;
  }

  private extractDataFromKnowledge(job: Job): string {
    const dataChunks: string[] = [];
    
    for (const chunk of job.knowledgePack.chunks) {
      if (chunk.source?.includes('.csv') || 
          chunk.source?.includes('.xlsx') ||
          chunk.content.includes('followers') ||
          chunk.content.includes('likes')) {
        dataChunks.push(chunk.content);
      }
    }
    
    return dataChunks.join('\n\n') || 'אין נתונים גולמיים';
  }

  private extractParameters(input: string): CampaignParams {
    const params: CampaignParams = {};

    // Extract budget
    const budgetMatch = input.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:ש[״"]?ח|₪|שקל)/);
    if (budgetMatch) {
      params.budget = parseInt(budgetMatch[1].replace(/,/g, ''));
    }

    // Extract influencer count
    const influencerMatch = input.match(/(\d+)\s*משפיענ/);
    if (influencerMatch) {
      params.influencerCount = parseInt(influencerMatch[1]);
    }

    // Extract duration
    const durationMatch = input.match(/(\d+)\s*(?:יו|ימים|שבוע|חודש)/);
    if (durationMatch) {
      let days = parseInt(durationMatch[1]);
      if (input.includes('שבוע')) days *= 7;
      if (input.includes('חודש')) days *= 30;
      params.campaignDuration = days;
    }

    // Extract deliverables
    const deliverables: { type: string; count: number }[] = [];
    
    const reelsMatch = input.match(/(\d+)\s*(?:רילים|reels)/i);
    if (reelsMatch) {
      deliverables.push({ type: 'רילים', count: parseInt(reelsMatch[1]) });
    }

    const storiesMatch = input.match(/(\d+)\s*(?:סטוריז|stories)/i);
    if (storiesMatch) {
      deliverables.push({ type: 'סטוריז', count: parseInt(storiesMatch[1]) });
    }

    const postsMatch = input.match(/(\d+)\s*(?:פוסטים|posts)/i);
    if (postsMatch) {
      deliverables.push({ type: 'פוסטים', count: parseInt(postsMatch[1]) });
    }

    if (deliverables.length > 0) {
      params.deliverables = deliverables;
    }

    // Extract industry
    const industries = ['אופנה', 'קוסמטיקה', 'מזון', 'טכנולוגיה', 'לייפסטייל', 'ספורט'];
    for (const ind of industries) {
      if (input.includes(ind)) {
        params.industry = ind;
        break;
      }
    }

    return params;
  }

  private generateBenchmarks(kpis: CalculatedKPIs, industry?: string): Benchmarks {
    // Industry benchmarks for Israeli market
    const industryBenchmarks: Record<string, { avgCPE: number; avgCPM: number; avgEngagement: number }> = {
      'אופנה': { avgCPE: 2.0, avgCPM: 12, avgEngagement: 4.5 },
      'קוסמטיקה': { avgCPE: 2.5, avgCPM: 15, avgEngagement: 4.0 },
      'מזון': { avgCPE: 1.8, avgCPM: 10, avgEngagement: 5.0 },
      'טכנולוגיה': { avgCPE: 3.5, avgCPM: 20, avgEngagement: 2.5 },
      'לייפסטייל': { avgCPE: 2.2, avgCPM: 13, avgEngagement: 4.2 },
      'ספורט': { avgCPE: 2.0, avgCPM: 11, avgEngagement: 4.8 },
      'default': { avgCPE: 2.5, avgCPM: 15, avgEngagement: 3.5 },
    };

    const benchmark = industryBenchmarks[industry || 'default'] || industryBenchmarks['default'];

    return {
      cpeVsAverage: this.compareToAverage(kpis.cpe, benchmark.avgCPE),
      cpmVsAverage: this.compareToAverage(kpis.cpm, benchmark.avgCPM),
      industryAvgCPE: benchmark.avgCPE,
      industryAvgCPM: benchmark.avgCPM,
      industryAvgEngagement: benchmark.avgEngagement,
      recommendation: this.getRecommendation(kpis, benchmark),
    };
  }

  private compareToAverage(value: number, average: number): 'better' | 'similar' | 'worse' {
    const diff = (value - average) / average;
    if (diff < -0.15) return 'better';
    if (diff > 0.15) return 'worse';
    return 'similar';
  }

  private getRecommendation(kpis: CalculatedKPIs, benchmark: any): string {
    if (kpis.cpe < benchmark.avgCPE * 0.8) {
      return 'תקציב מצוין! CPE נמוך מהממוצע בתעשייה';
    }
    if (kpis.cpe > benchmark.avgCPE * 1.2) {
      return 'שקול להגדיל את מספר המשפיענים או התוצרים לשיפור CPE';
    }
    return 'התקציב והתוצרים במסגרת הסבירה לתעשייה';
  }

  private formatOutput(
    params: CampaignParams,
    kpis: CalculatedKPIs,
    benchmarks: Benchmarks,
    pythonAnalysis?: string
  ): string {
    const lines: string[] = [
      '# 📊 חישוב KPI לקמפיין משפיענים',
      '',
      '## פרמטרים',
      `- **תקציב:** ${params.budget?.toLocaleString() || 'לא צוין'} ₪`,
      `- **מספר משפיענים:** ${params.influencerCount || 5}`,
      `- **משך קמפיין:** ${params.campaignDuration || 30} ימים`,
    ];

    if (params.deliverables && params.deliverables.length > 0) {
      lines.push('- **תוצרים:**');
      for (const d of params.deliverables) {
        lines.push(`  - ${d.count}x ${d.type}`);
      }
    }

    if (params.industry) {
      lines.push(`- **תעשייה:** ${params.industry}`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 📈 מדדים צפויים');
    lines.push('');
    lines.push(`| מדד | ערך |`);
    lines.push(`|-----|-----|`);
    lines.push(`| חשיפה צפויה | ${kpis.expectedReach.toLocaleString()} |`);
    lines.push(`| מעורבות צפויה | ${kpis.expectedEngagement.toLocaleString()} |`);
    lines.push(`| אימפרשנים | ${kpis.estimatedImpressions.toLocaleString()} |`);
    lines.push(`| **CPE** | **${kpis.cpe} ₪** |`);
    lines.push(`| **CPM** | **${kpis.cpm} ₪** |`);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 🎯 השוואה לממוצע בתעשייה');
    lines.push('');
    
    const cpeIcon = benchmarks.cpeVsAverage === 'better' ? '✅' : 
                    benchmarks.cpeVsAverage === 'worse' ? '⚠️' : '➡️';
    const cpmIcon = benchmarks.cpmVsAverage === 'better' ? '✅' : 
                    benchmarks.cpmVsAverage === 'worse' ? '⚠️' : '➡️';

    lines.push(`| מדד | שלך | ממוצע | סטטוס |`);
    lines.push(`|-----|-----|-------|-------|`);
    lines.push(`| CPE | ${kpis.cpe} ₪ | ${benchmarks.industryAvgCPE} ₪ | ${cpeIcon} |`);
    lines.push(`| CPM | ${kpis.cpm} ₪ | ${benchmarks.industryAvgCPM} ₪ | ${cpmIcon} |`);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 💡 המלצה');
    lines.push('');
    lines.push(benchmarks.recommendation);
    lines.push('');
    // Add Python analysis if available
    if (pythonAnalysis) {
      lines.push('---');
      lines.push('');
      lines.push('## 🐍 ניתוח נתונים (Code Execution)');
      lines.push('');
      lines.push(pythonAnalysis);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(`*${kpis.explanation}*`);

    return lines.join('\n');
  }
}

interface CampaignParams {
  budget?: number;
  influencerCount?: number;
  deliverables?: { type: string; count: number }[];
  campaignDuration?: number;
  industry?: string;
}

interface Benchmarks {
  cpeVsAverage: 'better' | 'similar' | 'worse';
  cpmVsAverage: 'better' | 'similar' | 'worse';
  industryAvgCPE: number;
  industryAvgCPM: number;
  industryAvgEngagement: number;
  recommendation: string;
}
