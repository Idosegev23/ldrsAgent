/**
 * Editor Agent
 * Combines outputs from multiple agents into a single coherent response
 */

import { BaseAgent } from '../../base-agent.js';
import type { Job, AgentResult } from '../../../types/job.types.js';
import type { Intent, AgentLayer } from '../../../types/agent.types.js';

export interface AgentOutput {
  agentId: string;
  agentName: string;
  output: string;
}

export class EditorAgent extends BaseAgent {
  id = 'core/editor';
  name = 'Editor Agent';
  nameHebrew = 'סוכן עריכה ואיחוד';
  layer: AgentLayer = 0; // Core layer
  domain = 'core';
  capabilities = [
    'combine-outputs',
    'remove-duplicates',
    'organize-content',
    'format-response',
  ];
  description = 'מאחד פלטים ממספר סוכנים לתשובה אחת ברורה ומקיפה';

  // Store outputs from previous agents
  private previousOutputs: AgentOutput[] = [];
  private editorPrompt: string = '';

  /**
   * Set the outputs from previous agents to combine
   */
  setPreviousOutputs(outputs: AgentOutput[]): void {
    this.previousOutputs = outputs;
  }

  /**
   * Set custom editor prompt
   */
  setEditorPrompt(prompt: string): void {
    this.editorPrompt = prompt;
  }

  canHandle(intent: Intent): boolean {
    // Editor agent is called directly by orchestrator, not by intent matching
    return false;
  }

  async execute(job: Job): Promise<AgentResult> {
    this.log.info('Executing editor agent', {
      jobId: job.id,
      outputCount: this.previousOutputs.length,
    });

    if (this.previousOutputs.length === 0) {
      return this.failure('אין פלטים לאיחוד');
    }

    // If only one output, return it directly
    if (this.previousOutputs.length === 1) {
      return this.success(this.previousOutputs[0].output, {
        confidence: 'high',
      });
    }

    // Build the outputs section for the prompt
    const outputsSection = this.previousOutputs.map((output, index) => {
      return `### פלט ${index + 1} - ${output.agentName}:
${output.output}`;
    }).join('\n\n---\n\n');

    const prompt = `אתה עורך תוכן מקצועי. קיבלת פלטים מכמה סוכנים ואתה צריך לאחד אותם לתשובה אחת מפורמטת ומעוצבת.

## הבקשה המקורית:
${job.rawInput}

## הפלטים שהתקבלו:
${outputsSection}

## ההנחיות שלך:
${this.editorPrompt || 'אחד את הפלטים לתשובה אחת ברורה ומקיפה'}

## כללים עריכה:
1. **הסר כפילויות** - אם אותו מידע מופיע בכמה פלטים, הכלל אותו פעם אחת
2. **ארגן לפי נושאים** - קבץ מידע דומה יחד בסעיפים ברורים
3. **שמור על קוהרנטיות** - התשובה צריכה לזרום בצורה הגיונית
4. **ציין מקורות** - אם יש ציטוטים או מקורות, שמור עליהם
5. **כתוב בעברית תקנית ומקצועית**

## כללי פורמט חובה:
📝 **השתמש ב-Markdown עשיר:**
- כותרות: # כותרת ראשית, ## כותרת משנית, ### כותרת שלישית
- רשימות: - נקודה או 1. מספר
- הדגשות: **טקסט מודגש**, *טקסט נטוי*
- קישורים: [טקסט](URL) אם יש
- טבלאות: אם יש נתונים מספריים או השוואה
- ציטוטים: > לציטוטים חשובים
- קוד/מספרים: \`טקסט\` להדגשת מספרים, תאריכים, סכומים
- אמוג'ים: השתמש באמוג'ים רלוונטיים לשיפור חווית קריאה (📊 📈 ✅ 💡 ⚠️ וכו')

📐 **מבנה חובה:**
1. **כותרת ראשית** (# או ##)
2. **סיכום ביצוע** (2-3 שורות)
3. **תוכן מפורט** (עם כותרות משנה)
4. **מסקנות/המלצות** (אם רלוונטי)
5. **צעדים הבאים** (אם רלוונטי)

## חשוב מאוד:
⚠️ **אסור לכתוב placeholders!** - לא [X], לא [Y], לא [להשלים], לא [נתון חסר]
⚠️ אם אין נתון ספציפי - כתוב "נתון לא זמין בשלב זה" או השמט את השדה לחלוטין
⚠️ אם הפלט המקורי מכיל placeholders - אל תעתיק אותם! החלף אותם בטקסט ברור או השמט
⚠️ הפלט חייב להיות מפורמט יפה עם markdown - לא מלל רץ!

## דוגמה לפורמט טוב:

# 📊 דוח ניתוח PPC - חודש דצמבר

בוצע ניתוח מעמיק של נתוני המדיה בדרייב.

## ✅ ממצאים עיקריים

- **תקציב כולל**: \`₪15,000\`
- **ROI**: **2.3x**
- **קמפיינים פעילים**: 5

## 📈 ביצועים לפי ערוץ

| ערוץ | השקעה | המרות |
|------|-------|-------|
| Facebook | ₪8,000 | 120 |
| Google | ₪7,000 | 95 |

## 💡 המלצות

1. **להגדיל תקציב** ב-Facebook בגלל ROI גבוה
2. **לייעל** קמפיין Google

---

## התשובה המאוחדת (בפורמט Markdown עשיר):`;


    try {
      const combinedOutput = await this.callLLM(prompt, 'reasoning');

      this.log.info('Editor agent completed', {
        jobId: job.id,
        inputCount: this.previousOutputs.length,
        outputLength: combinedOutput.length,
      });

      return this.success(combinedOutput, {
        confidence: 'high',
        structured: {
          combinedFrom: this.previousOutputs.map(o => o.agentId),
          inputCount: this.previousOutputs.length,
        },
      });
    } catch (error) {
      this.log.error('Editor agent failed', error as Error);
      
      // Fallback: concatenate outputs with headers
      const fallbackOutput = this.previousOutputs.map((output, index) => {
        return `## ${output.agentName}\n\n${output.output}`;
      }).join('\n\n---\n\n');

      return this.success(fallbackOutput, {
        confidence: 'medium',
      });
    }
  }
}
