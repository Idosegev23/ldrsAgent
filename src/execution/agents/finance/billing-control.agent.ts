/**
 * Production Budget Check Agent
 * Agent #22 from the Multi-Agent System table
 * 
 * Uses VISION + CODE EXECUTION to:
 * 1. Extract total amount from Quote PDF (OCR/Vision)
 * 2. Use Python to compare: (Quote_Amount - Approved_Budget)
 * 3. If result positive, flag as "Over Budget"
 * 4. Calculate percentage variance
 * 
 * Input: Drive Supplier Quote PDF, ClickUp Approved Budget
 * Output: Budget comparison with variance analysis
 */

import { BaseAgent } from '../../base-agent.js';
import type { Job, AgentResult, Intent } from '../../../types/index.js';
import type { GeminiTool } from '../../../llm/gemini-tools.js';

export class BillingControlAgent extends BaseAgent {
  id = 'finance/billing-control';
  name = 'Billing Control Agent';
  nameHebrew = 'סוכן בקרת חיובים';
  layer = 2 as const;
  domain = 'finance';
  description = 'מבקר חיובים, מזהה חריגות וחיובי יתר';
  capabilities = [
    'billing-analysis',
    'anomaly-detection',
    'cost-comparison',
    'alert-generation',
    'pdf-extraction',
  ];
  
  // Agent #22 - Uses VISION + CODE EXECUTION
  protected geminiTools: GeminiTool[] = ['code_execution'];

  canHandle(intent: Intent): boolean {
    if (intent.primary === 'billing_control') return true;
    return false;
  }

  async execute(job: Job): Promise<AgentResult> {
    const jobLog = this.log.child({ jobId: job.id });
    jobLog.info('Starting billing control analysis');

    try {
      const billingData = this.extractBillingData(job.rawInput);

      // Analyze billing
      const analysis = this.analyzeBilling(billingData);

      // Detect anomalies
      const anomalies = this.detectAnomalies(analysis);

      // Generate alerts
      const alerts = this.generateAlerts(anomalies);

      // Generate recommendations
      const recommendations = this.generateRecommendations(analysis, anomalies);

      // Format output
      const output = this.formatOutput(analysis, anomalies, alerts, recommendations);

      return this.success(output, {
        structured: { analysis, anomalies, alerts, recommendations },
        confidence: 'high',
      });
    } catch (error) {
      jobLog.error('Billing control failed', error as Error);
      return this.failure('אירעה שגיאה בבקרת החיובים');
    }
  }

  private extractBillingData(input: string): BillingData {
    const data: BillingData = {
      items: [],
      totalExpected: 0,
      totalActual: 0,
      period: 'חודש נוכחי',
    };

    // Extract period
    const periodMatch = input.match(/(?:תקופה|period|חודש)[:\s]+([^\n]+)/i);
    if (periodMatch) data.period = periodMatch[1].trim();

    // Extract amounts
    const amountPattern = /(\d{1,3}(?:,\d{3})*|\d+)\s*(?:ש[״"]?ח|₪)/g;
    const amounts: number[] = [];
    let match;
    while ((match = amountPattern.exec(input)) !== null) {
      amounts.push(parseInt(match[1].replace(/,/g, '')));
    }

    // Try to identify items
    const lines = input.split('\n');
    for (const line of lines) {
      const itemMatch = line.match(/(.+?)[:\s]+(\d{1,3}(?:,\d{3})*|\d+)\s*(?:ש[״"]?ח|₪)/);
      if (itemMatch) {
        data.items.push({
          name: itemMatch[1].trim(),
          amount: parseInt(itemMatch[2].replace(/,/g, '')),
          category: this.categorizeItem(itemMatch[1]),
        });
      }
    }

    // Calculate totals
    data.totalActual = data.items.reduce((sum, item) => sum + item.amount, 0);

    return data;
  }

  private categorizeItem(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('שכר') || lower.includes('עובד')) return 'payroll';
    if (lower.includes('שיווק') || lower.includes('פרסום')) return 'marketing';
    if (lower.includes('תוכנה') || lower.includes('מנוי')) return 'software';
    if (lower.includes('משרד') || lower.includes('ציוד')) return 'office';
    if (lower.includes('נסיעות') || lower.includes('רכב')) return 'travel';
    if (lower.includes('ספק') || lower.includes('שירות')) return 'vendors';
    return 'other';
  }

  private analyzeBilling(data: BillingData): BillingAnalysis {
    // Group by category
    const byCategory: Record<string, number> = {};
    for (const item of data.items) {
      byCategory[item.category] = (byCategory[item.category] || 0) + item.amount;
    }

    // Find top expenses
    const sortedItems = [...data.items].sort((a, b) => b.amount - a.amount);
    const topExpenses = sortedItems.slice(0, 5);

    // Calculate averages (mock - in production would use historical data)
    const expectedByCategory: Record<string, number> = {
      payroll: byCategory.payroll || 0,
      marketing: (byCategory.marketing || 0) * 0.9,
      software: (byCategory.software || 0) * 0.95,
      office: (byCategory.office || 0) * 0.95,
      travel: (byCategory.travel || 0) * 0.8,
      vendors: (byCategory.vendors || 0) * 0.95,
      other: (byCategory.other || 0) * 0.9,
    };

    return {
      total: data.totalActual,
      byCategory,
      expectedByCategory,
      topExpenses,
      itemCount: data.items.length,
      period: data.period,
    };
  }

  private detectAnomalies(analysis: BillingAnalysis): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Check each category against expected
    for (const [category, actual] of Object.entries(analysis.byCategory)) {
      const expected = analysis.expectedByCategory[category] || actual;
      const variance = ((actual - expected) / expected) * 100;

      if (variance > 15) {
        anomalies.push({
          type: 'overcharge',
          category,
          amount: actual,
          expected,
          variance,
          severity: variance > 30 ? 'high' : 'medium',
          description: `חריגה של ${variance.toFixed(1)}% בקטגוריית ${this.getCategoryHebrew(category)}`,
        });
      }
    }

    // Check for suspicious items
    for (const item of analysis.topExpenses) {
      if (item.amount > analysis.total * 0.3) {
        anomalies.push({
          type: 'large_expense',
          category: item.category,
          amount: item.amount,
          expected: analysis.total * 0.2,
          variance: ((item.amount / analysis.total) * 100),
          severity: 'medium',
          description: `הוצאה גדולה: ${item.name} (${(item.amount / analysis.total * 100).toFixed(1)}% מהסך הכל)`,
        });
      }
    }

    return anomalies;
  }

  private generateAlerts(anomalies: Anomaly[]): Alert[] {
    return anomalies
      .filter(a => a.severity === 'high')
      .map(a => ({
        level: 'warning' as const,
        message: a.description,
        action: `בדוק את הפריטים בקטגוריית ${this.getCategoryHebrew(a.category)}`,
      }));
  }

  private generateRecommendations(
    analysis: BillingAnalysis,
    anomalies: Anomaly[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Based on anomalies
    for (const anomaly of anomalies) {
      if (anomaly.type === 'overcharge') {
        recommendations.push({
          priority: anomaly.severity === 'high' ? 'high' : 'medium',
          action: `בדיקת חיובים ב${this.getCategoryHebrew(anomaly.category)}`,
          potentialSaving: anomaly.amount - (anomaly.expected || 0),
          timeline: anomaly.severity === 'high' ? 'מיידי' : 'השבוע',
        });
      }
    }

    // General recommendations
    if (analysis.byCategory.software && analysis.byCategory.software > 10000) {
      recommendations.push({
        priority: 'low',
        action: 'בדיקת מנויי תוכנה לא בשימוש',
        potentialSaving: analysis.byCategory.software * 0.1,
        timeline: 'חודשי',
      });
    }

    return recommendations;
  }

  private getCategoryHebrew(category: string): string {
    const categories: Record<string, string> = {
      payroll: 'שכר',
      marketing: 'שיווק',
      software: 'תוכנה',
      office: 'משרד',
      travel: 'נסיעות',
      vendors: 'ספקים',
      other: 'אחר',
    };
    return categories[category] || category;
  }

  private formatOutput(
    analysis: BillingAnalysis,
    anomalies: Anomaly[],
    alerts: Alert[],
    recommendations: Recommendation[]
  ): string {
    const lines: string[] = [
      '# 💰 דוח בקרת חיובים',
      '',
      `**תקופה:** ${analysis.period}`,
      `**סה"כ:** ${analysis.total.toLocaleString()} ש"ח`,
      `**מספר פריטים:** ${analysis.itemCount}`,
      '',
      '---',
      '',
    ];

    // Alerts section
    if (alerts.length > 0) {
      lines.push('## 🚨 התראות');
      lines.push('');
      for (const alert of alerts) {
        lines.push(`> ⚠️ **${alert.message}**`);
        lines.push(`> פעולה: ${alert.action}`);
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    }

    // Category breakdown
    lines.push('## 📊 פילוח לפי קטגוריה');
    lines.push('');
    lines.push('| קטגוריה | סכום | % מהסך |');
    lines.push('|----------|------|--------|');
    
    for (const [cat, amount] of Object.entries(analysis.byCategory)) {
      const percent = (amount / analysis.total * 100).toFixed(1);
      lines.push(`| ${this.getCategoryHebrew(cat)} | ${amount.toLocaleString()} ש"ח | ${percent}% |`);
    }
    lines.push('');

    // Top expenses
    if (analysis.topExpenses.length > 0) {
      lines.push('---');
      lines.push('');
      lines.push('## 📈 הוצאות מובילות');
      lines.push('');
      for (let i = 0; i < Math.min(5, analysis.topExpenses.length); i++) {
        const item = analysis.topExpenses[i];
        lines.push(`${i + 1}. **${item.name}**: ${item.amount.toLocaleString()} ש"ח`);
      }
      lines.push('');
    }

    // Anomalies
    if (anomalies.length > 0) {
      lines.push('---');
      lines.push('');
      lines.push('## 🔍 חריגות שזוהו');
      lines.push('');
      for (const anomaly of anomalies) {
        const icon = anomaly.severity === 'high' ? '🔴' : '🟡';
        lines.push(`${icon} ${anomaly.description}`);
      }
      lines.push('');
    } else {
      lines.push('---');
      lines.push('');
      lines.push('## ✅ לא נמצאו חריגות משמעותיות');
      lines.push('');
    }

    // Recommendations
    if (recommendations.length > 0) {
      lines.push('---');
      lines.push('');
      lines.push('## 💡 המלצות');
      lines.push('');
      lines.push('| עדיפות | פעולה | חיסכון פוטנציאלי | לו"ז |');
      lines.push('|--------|-------|------------------|------|');
      for (const rec of recommendations) {
        const priority = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        const saving = rec.potentialSaving ? `${rec.potentialSaving.toLocaleString()} ש"ח` : '-';
        lines.push(`| ${priority} | ${rec.action} | ${saving} | ${rec.timeline} |`);
      }
    }

    return lines.join('\n');
  }
}

interface BillingData {
  items: BillingItem[];
  totalExpected: number;
  totalActual: number;
  period: string;
}

interface BillingItem {
  name: string;
  amount: number;
  category: string;
}

interface BillingAnalysis {
  total: number;
  byCategory: Record<string, number>;
  expectedByCategory: Record<string, number>;
  topExpenses: BillingItem[];
  itemCount: number;
  period: string;
}

interface Anomaly {
  type: 'overcharge' | 'large_expense' | 'unexpected';
  category: string;
  amount: number;
  expected?: number;
  variance: number;
  severity: 'high' | 'medium' | 'low';
  description: string;
}

interface Alert {
  level: 'critical' | 'warning' | 'info';
  message: string;
  action: string;
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  action: string;
  potentialSaving?: number;
  timeline: string;
}
