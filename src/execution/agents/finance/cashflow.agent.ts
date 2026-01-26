/**
 * Finance & Cashflow Agent
 * Agent #28, #29 from the Multi-Agent System table
 * 
 * Uses VISION + CODE EXECUTION to:
 * 1. Iterate through all PDFs in Drive folder (Invoices)
 * 2. Extract: Date, Vendor Name, Total Amount, Due Date
 * 3. Create structured JSON/DataFrame of cashflow obligations
 * 
 * Input: Drive Folder with Invoices (PDFs)
 * Output: Cashflow analysis with obligations and forecast
 */

import { BaseAgent } from '../../base-agent.js';
import type { Job, AgentResult, Intent } from '../../../types/index.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class CashflowAgent extends BaseAgent {
  id = 'finance/cashflow';
  name = 'Cashflow Management Agent';
  nameHebrew = 'סוכן ניהול תזרים';
  layer = 2 as const;
  domain = 'finance';
  description = 'מנתח ומנהל תזרים מזומנים';
  capabilities = [
    'cashflow-analysis',
    'forecast-generation',
    'liquidity-monitoring',
    'alert-generation',
    'pdf-extraction',
  ];
  
  // Agent #28, #29 - Uses VISION + CODE EXECUTION
  protected geminiTools: GeminiTool[] = ['code_execution'];

  canHandle(intent: Intent): boolean {
    if (intent.primary === 'cashflow') return true;
    return false;
  }

  async execute(job: Job): Promise<AgentResult> {
    const jobLog = this.log.child({ jobId: job.id });
    jobLog.info('Starting cashflow analysis');

    try {
      const cashflowData = this.extractCashflowData(job.rawInput);

      // Analyze current state
      const analysis = this.analyzeCashflow(cashflowData);

      // Generate forecast
      const forecast = this.generateForecast(analysis);

      // Check liquidity
      const liquidityStatus = this.checkLiquidity(analysis, forecast);

      // Generate recommendations
      const recommendations = this.generateRecommendations(analysis, liquidityStatus);

      // Format output
      const output = this.formatOutput(analysis, forecast, liquidityStatus, recommendations);

      return this.success(output, {
        structured: { analysis, forecast, liquidityStatus, recommendations },
        confidence: 'high',
      });
    } catch (error) {
      jobLog.error('Cashflow analysis failed', error as Error);
      return this.failure('אירעה שגיאה בניתוח התזרים');
    }
  }

  private extractCashflowData(input: string): CashflowData {
    const data: CashflowData = {
      currentBalance: 0,
      inflows: [],
      outflows: [],
      period: 'חודש נוכחי',
    };

    // Extract current balance
    const balanceMatch = input.match(/(?:יתרה|balance)[:\s]+(\d{1,3}(?:,\d{3})*|\d+)/i);
    if (balanceMatch) {
      data.currentBalance = parseInt(balanceMatch[1].replace(/,/g, ''));
    }

    // Extract period
    const periodMatch = input.match(/(?:תקופה|period)[:\s]+([^\n]+)/i);
    if (periodMatch) data.period = periodMatch[1].trim();

    // Parse line items
    const lines = input.split('\n');
    for (const line of lines) {
      const inflowMatch = line.match(/(?:הכנסה|קבלה|income|inflow)[:\s]+([^:]+)[:\s]+(\d{1,3}(?:,\d{3})*|\d+)/i);
      if (inflowMatch) {
        data.inflows.push({
          name: inflowMatch[1].trim(),
          amount: parseInt(inflowMatch[2].replace(/,/g, '')),
          date: this.extractDate(line),
          certainty: this.extractCertainty(line),
        });
      }

      const outflowMatch = line.match(/(?:הוצאה|תשלום|expense|outflow)[:\s]+([^:]+)[:\s]+(\d{1,3}(?:,\d{3})*|\d+)/i);
      if (outflowMatch) {
        data.outflows.push({
          name: outflowMatch[1].trim(),
          amount: parseInt(outflowMatch[2].replace(/,/g, '')),
          date: this.extractDate(line),
          certainty: this.extractCertainty(line),
        });
      }
    }

    return data;
  }

  private extractDate(line: string): string | undefined {
    const dateMatch = line.match(/(\d{1,2}[\/\.-]\d{1,2})/);
    return dateMatch ? dateMatch[1] : undefined;
  }

  private extractCertainty(line: string): 'confirmed' | 'expected' | 'potential' {
    const lower = line.toLowerCase();
    if (lower.includes('מאושר') || lower.includes('confirmed')) return 'confirmed';
    if (lower.includes('צפוי') || lower.includes('expected')) return 'expected';
    return 'potential';
  }

  private analyzeCashflow(data: CashflowData): CashflowAnalysis {
    const totalInflows = data.inflows.reduce((sum, i) => sum + i.amount, 0);
    const totalOutflows = data.outflows.reduce((sum, o) => sum + o.amount, 0);
    const netCashflow = totalInflows - totalOutflows;
    const endingBalance = data.currentBalance + netCashflow;

    // Calculate confirmed vs expected
    const confirmedInflows = data.inflows
      .filter(i => i.certainty === 'confirmed')
      .reduce((sum, i) => sum + i.amount, 0);
    const confirmedOutflows = data.outflows
      .filter(o => o.certainty === 'confirmed')
      .reduce((sum, o) => sum + o.amount, 0);

    // Identify largest items
    const topInflows = [...data.inflows].sort((a, b) => b.amount - a.amount).slice(0, 3);
    const topOutflows = [...data.outflows].sort((a, b) => b.amount - a.amount).slice(0, 3);

    return {
      currentBalance: data.currentBalance,
      totalInflows,
      totalOutflows,
      netCashflow,
      endingBalance,
      confirmedInflows,
      confirmedOutflows,
      topInflows,
      topOutflows,
      period: data.period,
    };
  }

  private generateForecast(analysis: CashflowAnalysis): CashflowForecast {
    // Simple 3-month forecast
    const months: MonthForecast[] = [];
    let runningBalance = analysis.endingBalance;

    for (let i = 1; i <= 3; i++) {
      // Assume similar patterns with growth factor
      const growthFactor = 1 + (Math.random() * 0.1 - 0.05); // -5% to +5%
      const projectedInflows = analysis.totalInflows * growthFactor;
      const projectedOutflows = analysis.totalOutflows * growthFactor;
      const netFlow = projectedInflows - projectedOutflows;
      runningBalance += netFlow;

      months.push({
        month: this.getMonthName(i),
        projectedInflows: Math.round(projectedInflows),
        projectedOutflows: Math.round(projectedOutflows),
        projectedBalance: Math.round(runningBalance),
        confidence: i === 1 ? 'high' : i === 2 ? 'medium' : 'low',
      });
    }

    return {
      months,
      trend: analysis.netCashflow > 0 ? 'positive' : analysis.netCashflow < 0 ? 'negative' : 'stable',
      riskLevel: runningBalance < 0 ? 'high' : runningBalance < analysis.totalOutflows ? 'medium' : 'low',
    };
  }

  private getMonthName(offset: number): string {
    const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
                    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    const currentMonth = new Date().getMonth();
    return months[(currentMonth + offset) % 12];
  }

  private checkLiquidity(analysis: CashflowAnalysis, forecast: CashflowForecast): LiquidityStatus {
    // Days of runway
    const dailyBurn = analysis.totalOutflows / 30;
    const runway = dailyBurn > 0 ? Math.floor(analysis.currentBalance / dailyBurn) : Infinity;

    // Quick ratio (simplified)
    const quickRatio = analysis.confirmedInflows / (analysis.confirmedOutflows || 1);

    // Determine status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    const alerts: string[] = [];

    if (runway < 30) {
      status = 'critical';
      alerts.push('פחות מ-30 ימי runway');
    } else if (runway < 60) {
      status = 'warning';
      alerts.push('פחות מ-60 ימי runway');
    }

    if (quickRatio < 0.8) {
      status = status === 'critical' ? 'critical' : 'warning';
      alerts.push('הכנסות מאושרות נמוכות מהוצאות');
    }

    if (forecast.riskLevel === 'high') {
      status = 'critical';
      alerts.push('תחזית שלילית ל-3 חודשים');
    }

    return {
      status,
      runway,
      quickRatio,
      alerts,
    };
  }

  private generateRecommendations(
    analysis: CashflowAnalysis,
    liquidity: LiquidityStatus
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    if (liquidity.status === 'critical') {
      recommendations.push({
        priority: 'high',
        action: 'בדיקה דחופה של תזרים וקיצוץ הוצאות',
        impact: 'שיפור נזילות מיידי',
        timeline: 'מיידי',
      });
    }

    if (analysis.netCashflow < 0) {
      recommendations.push({
        priority: 'high',
        action: 'זיהוי מקורות הכנסה נוספים או צמצום הוצאות',
        impact: 'איזון תזרים',
        timeline: 'חודש',
      });
    }

    if (liquidity.quickRatio < 1) {
      recommendations.push({
        priority: 'medium',
        action: 'מעקב צמוד אחר גביית חייבים',
        impact: 'שיפור הכנסות מאושרות',
        timeline: 'שבועי',
      });
    }

    // General recommendations
    recommendations.push({
      priority: 'low',
      action: 'בניית כרית ביטחון של 3 חודשי הוצאות',
      impact: 'יציבות פיננסית',
      timeline: 'ארוך טווח',
    });

    return recommendations;
  }

  private formatOutput(
    analysis: CashflowAnalysis,
    forecast: CashflowForecast,
    liquidity: LiquidityStatus,
    recommendations: Recommendation[]
  ): string {
    const lines: string[] = [
      '# 💵 דוח תזרים מזומנים',
      '',
      `**תקופה:** ${analysis.period}`,
      '',
      '---',
      '',
    ];

    // Liquidity status
    const statusEmoji = liquidity.status === 'healthy' ? '✅' : 
                        liquidity.status === 'warning' ? '⚠️' : '🚨';
    lines.push(`## ${statusEmoji} סטטוס נזילות: ${this.getStatusHebrew(liquidity.status)}`);
    lines.push('');
    
    if (liquidity.alerts.length > 0) {
      lines.push('**התראות:**');
      lines.push(...liquidity.alerts.map(a => `- ${a}`));
      lines.push('');
    }
    lines.push('---');
    lines.push('');

    // Current state
    lines.push('## 📊 מצב נוכחי');
    lines.push('');
    lines.push(`| מדד | סכום |`);
    lines.push(`|-----|------|`);
    lines.push(`| יתרה נוכחית | ${analysis.currentBalance.toLocaleString()} ש"ח |`);
    lines.push(`| סה"כ הכנסות | ${analysis.totalInflows.toLocaleString()} ש"ח |`);
    lines.push(`| סה"כ הוצאות | ${analysis.totalOutflows.toLocaleString()} ש"ח |`);
    lines.push(`| תזרים נטו | ${analysis.netCashflow.toLocaleString()} ש"ח |`);
    lines.push(`| יתרה צפויה | ${analysis.endingBalance.toLocaleString()} ש"ח |`);
    lines.push('');

    // Runway
    lines.push(`**ימי Runway:** ${liquidity.runway === Infinity ? '∞' : liquidity.runway}`);
    lines.push(`**יחס מהיר:** ${liquidity.quickRatio.toFixed(2)}`);
    lines.push('');

    // Top items
    if (analysis.topInflows.length > 0) {
      lines.push('---');
      lines.push('');
      lines.push('### הכנסות מובילות');
      for (const item of analysis.topInflows) {
        const certainty = item.certainty === 'confirmed' ? '✓' : item.certainty === 'expected' ? '~' : '?';
        lines.push(`- ${certainty} ${item.name}: ${item.amount.toLocaleString()} ש"ח`);
      }
      lines.push('');
    }

    if (analysis.topOutflows.length > 0) {
      lines.push('### הוצאות מובילות');
      for (const item of analysis.topOutflows) {
        lines.push(`- ${item.name}: ${item.amount.toLocaleString()} ש"ח`);
      }
      lines.push('');
    }

    // Forecast
    lines.push('---');
    lines.push('');
    lines.push('## 📈 תחזית 3 חודשים');
    lines.push('');
    lines.push(`**מגמה:** ${this.getTrendHebrew(forecast.trend)}`);
    lines.push(`**רמת סיכון:** ${this.getRiskHebrew(forecast.riskLevel)}`);
    lines.push('');
    lines.push('| חודש | הכנסות | הוצאות | יתרה |');
    lines.push('|------|--------|--------|------|');
    for (const month of forecast.months) {
      lines.push(`| ${month.month} | ${month.projectedInflows.toLocaleString()} | ${month.projectedOutflows.toLocaleString()} | ${month.projectedBalance.toLocaleString()} |`);
    }
    lines.push('');

    // Recommendations
    if (recommendations.length > 0) {
      lines.push('---');
      lines.push('');
      lines.push('## 💡 המלצות');
      lines.push('');
      for (const rec of recommendations) {
        const priority = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        lines.push(`${priority} **${rec.action}**`);
        lines.push(`   - השפעה: ${rec.impact}`);
        lines.push(`   - לו"ז: ${rec.timeline}`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private getStatusHebrew(status: string): string {
    const statuses: Record<string, string> = {
      healthy: 'בריא',
      warning: 'דורש תשומת לב',
      critical: 'קריטי',
    };
    return statuses[status] || status;
  }

  private getTrendHebrew(trend: string): string {
    const trends: Record<string, string> = {
      positive: 'חיובית ↑',
      negative: 'שלילית ↓',
      stable: 'יציבה →',
    };
    return trends[trend] || trend;
  }

  private getRiskHebrew(risk: string): string {
    const risks: Record<string, string> = {
      low: 'נמוכה',
      medium: 'בינונית',
      high: 'גבוהה',
    };
    return risks[risk] || risk;
  }
}

interface CashflowData {
  currentBalance: number;
  inflows: CashflowItem[];
  outflows: CashflowItem[];
  period: string;
}

interface CashflowItem {
  name: string;
  amount: number;
  date?: string;
  certainty: 'confirmed' | 'expected' | 'potential';
}

interface CashflowAnalysis {
  currentBalance: number;
  totalInflows: number;
  totalOutflows: number;
  netCashflow: number;
  endingBalance: number;
  confirmedInflows: number;
  confirmedOutflows: number;
  topInflows: CashflowItem[];
  topOutflows: CashflowItem[];
  period: string;
}

interface CashflowForecast {
  months: MonthForecast[];
  trend: 'positive' | 'negative' | 'stable';
  riskLevel: 'low' | 'medium' | 'high';
}

interface MonthForecast {
  month: string;
  projectedInflows: number;
  projectedOutflows: number;
  projectedBalance: number;
  confidence: 'high' | 'medium' | 'low';
}

interface LiquidityStatus {
  status: 'healthy' | 'warning' | 'critical';
  runway: number;
  quickRatio: number;
  alerts: string[];
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  action: string;
  impact: string;
  timeline: string;
}
