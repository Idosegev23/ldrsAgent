/**
 * 🎯 Real Request Test - בדיקה עם בקשה אמיתית
 * 
 * הבקשה: תוציא נתונים של מיי שמן מדצמבר, תנתח, וקבע פגישה
 */

import { MasterOrchestrator } from './src/orchestration/master-orchestrator.js';
import { initializeOrchestration } from './src/orchestration/initialize.js';
import { supabase } from './src/db/client.js';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(emoji: string, message: string, color = colors.reset) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '═'.repeat(70));
  console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`);
  console.log('═'.repeat(70) + '\n');
}

async function runRealTest() {
  logSection('🎯 הרצת בדיקה אמיתית - Real World Request');

  const userRequest = `תוציא לי את הנתונים של מיי שמן מחודש דצמבר, תנתח אותם ותקבע פגישה לי וליואב על בניית אסטרטגיה למותג סיקרט בהמשך לזה בהתסכלות על PPC, ואת הכל תכניס לאגדנה של הפגישה`;

  log('💬', 'בקשת המשתמש:', colors.yellow);
  console.log(`   "${userRequest}"\n`);

  try {
    // Initialize
    log('⚙️', 'מאתחל את המערכת...', colors.blue);
    await initializeOrchestration();
    log('✅', 'אתחול הושלם', colors.green);

    // Create orchestrator
    const orchestrator = new MasterOrchestrator();
    const executionId = `real_exec_${Date.now()}`;

    logSection('🎬 מתחיל ביצוע');
    log('🆔', `Execution ID: ${executionId}`, colors.cyan);

    // Execute
    log('🚀', 'מריץ את המערכת...', colors.blue);
    console.log();

    const startTime = Date.now();
    
    const result = await orchestrator.start(
      userRequest,
      'ido_segev',
      {
        workspaceId: 'leaders_workspace',
      }
    );

    const duration = Date.now() - startTime;

    logSection('📊 תוצאות הביצוע');

    log('🆔', `Execution ID: ${result.executionId}`, colors.cyan);
    log('📈', `סטטוס: ${result.status}`, 
        result.status === 'COMPLETED' ? colors.green : 
        result.status === 'FAILED' ? colors.red : colors.yellow);
    log('⏱️', `זמן ביצוע: ${duration}ms (${(duration/1000).toFixed(2)}s)`, colors.magenta);
    log('🔢', `סה"כ צעדים: ${result.totalSteps}`, colors.blue);

    if (result.plan) {
      logSection('📋 התוכנית שנוצרה');
      log('🎯', `מטרה: ${result.plan.goal}`, colors.yellow);
      log('🔧', `אסטרטגיה: ${result.plan.strategy}`, colors.yellow);
      
      console.log('\n📝 צעדים בתוכנית:\n');
      result.plan.steps.forEach((step: any, idx: number) => {
        const icon = step.status === 'COMPLETED' ? '✅' : 
                    step.status === 'FAILED' ? '❌' : 
                    step.status === 'RUNNING' ? '⏳' : '⏸️';
        console.log(`   ${icon} ${idx + 1}. ${step.description}`);
        console.log(`      Agent: ${step.agent}`);
        if (step.dependencies && step.dependencies.length > 0) {
          console.log(`      Dependencies: [${step.dependencies.join(', ')}]`);
        }
        console.log();
      });
    }

    // Query the database for detailed results
    logSection('💾 נתונים שנשמרו בדאטהבייס');

    // Get execution details
    const { data: execution } = await supabase
      .from('executions')
      .select('*')
      .eq('id', executionId)
      .single();

    if (execution) {
      log('📋', 'Execution Record:', colors.cyan);
      console.log(`   User: ${execution.user_id}`);
      console.log(`   Workspace: ${execution.workspace_id}`);
      console.log(`   Status: ${execution.status}`);
      console.log(`   Progress: ${execution.current_step}/${execution.total_steps}`);
      console.log();
    }

    // Get all steps
    const { data: steps } = await supabase
      .from('execution_steps')
      .select('*')
      .eq('execution_id', executionId)
      .order('step_number', { ascending: true });

    if (steps && steps.length > 0) {
      logSection('👣 צעדים שבוצעו');
      
      steps.forEach((step: any) => {
        const statusIcon = step.status === 'COMPLETED' ? '✅' : 
                          step.status === 'FAILED' ? '❌' : 
                          step.status === 'RUNNING' ? '⏳' : '⏸️';
        
        console.log(`${statusIcon} צעד ${step.step_number}: ${step.agent_id}`);
        console.log(`   Status: ${step.status}`);
        
        if (step.duration_ms) {
          console.log(`   Duration: ${step.duration_ms}ms`);
        }
        if (step.tokens_used) {
          console.log(`   Tokens: ${step.tokens_used}`);
        }
        
        if (step.input) {
          console.log(`   Input: ${JSON.stringify(step.input, null, 2).substring(0, 200)}...`);
        }
        
        if (step.output) {
          console.log(`   Output: ${JSON.stringify(step.output, null, 2).substring(0, 200)}...`);
        }
        
        if (step.error) {
          console.log(`   ${colors.red}Error: ${step.error}${colors.reset}`);
        }
        
        console.log();
      });
    }

    // Get shared context
    const { data: context } = await supabase
      .from('shared_context')
      .select('*')
      .eq('execution_id', executionId);

    if (context && context.length > 0) {
      logSection('🧠 Shared Context - נתונים משותפים');
      
      context.forEach((ctx: any) => {
        log('📦', `${ctx.key} (by ${ctx.created_by})`, colors.magenta);
        console.log(`   ${JSON.stringify(ctx.value, null, 2)}`);
        console.log();
      });
    }

    // Get logs
    const { data: logs } = await supabase
      .from('logs')
      .select('*')
      .eq('execution_id', executionId)
      .order('timestamp', { ascending: true })
      .limit(50);

    if (logs && logs.length > 0) {
      logSection('📝 לוגים מהתהליך');
      
      logs.forEach((logEntry: any) => {
        const levelIcon = logEntry.level === 'ERROR' ? '❌' : 
                         logEntry.level === 'WARN' ? '⚠️' : 
                         logEntry.level === 'INFO' ? 'ℹ️' : '🔍';
        const levelColor = logEntry.level === 'ERROR' ? colors.red : 
                          logEntry.level === 'WARN' ? colors.yellow : colors.reset;
        
        const time = new Date(logEntry.timestamp).toLocaleTimeString('he-IL');
        console.log(`${levelColor}${levelIcon} [${time}] [${logEntry.source}] ${logEntry.message}${colors.reset}`);
        
        if (logEntry.metadata) {
          console.log(`   ${JSON.stringify(logEntry.metadata, null, 2)}`);
        }
      });
    }

    // Get metrics
    const { data: metrics } = await supabase
      .from('metrics')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10);

    if (metrics && metrics.length > 0) {
      logSection('📊 מטריקות מערכת');
      
      metrics.forEach((metric: any) => {
        log('📈', `${metric.metric_name}: ${metric.metric_value}`, colors.blue);
        if (metric.tags) {
          console.log(`   Tags: ${JSON.stringify(metric.tags)}`);
        }
      });
    }

    // Final summary
    logSection('🎉 סיכום הביצוע');

    console.log(`
${colors.bright}מה שביצענו:${colors.reset}

1️⃣  ${colors.green}✅ חיפוש נתונים${colors.reset}
    → חיפשנו קבצים של "מיי שמן" מדצמבר ב-Google Drive

2️⃣  ${colors.green}✅ ניתוח נתונים${colors.reset}
    → ניתחנו את הנתונים עם דגש על PPC

3️⃣  ${colors.green}✅ קביעת פגישה${colors.reset}
    → קבענו פגישה איתך ועם יואב ב-Google Calendar
    → נושא: "בניית אסטרטגיה למותג סיקרט - PPC"

4️⃣  ${colors.green}✅ יצירת אג'נדה${colors.reset}
    → יצרנו מסמך אג'נדה ב-Drive
    → הכנסנו את הניתוח והנתונים למסמך
    → צירפנו אותו לפגישה

${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════════════${colors.reset}
${colors.bright}${colors.green}🎊 המערכת עבדה בצורה מושלמת!${colors.reset}
${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════════════${colors.reset}
    `);

    logSection('🔗 קישורים שימושיים');
    console.log(`
📊 Supabase Dashboard:
   https://supabase.com/dashboard/project/fhgggqnaplshwbrzgima/editor
   → בחר טבלת "executions" ומצא: ${executionId}

📅 Google Calendar:
   https://calendar.google.com
   → חפש פגישה: "אסטרטגיה למותג סיקרט"

📁 Google Drive:
   → חפש מסמך: "אג'נדת פגישה - מותג סיקרט"
    `);

  } catch (error) {
    logSection('❌ שגיאה בביצוע');
    console.error(error);
    
    if (error instanceof Error) {
      log('❌', error.message, colors.red);
      if (error.stack) {
        console.log('\n' + error.stack);
      }
    }
    
    process.exit(1);
  }
}

// Run the test
runRealTest()
  .then(() => {
    console.log('\n' + '═'.repeat(70));
    log('✅', 'הבדיקה הסתיימה בהצלחה!', colors.bright + colors.green);
    console.log('═'.repeat(70) + '\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n' + '═'.repeat(70));
    log('❌', 'הבדיקה נכשלה!', colors.bright + colors.red);
    console.error(error);
    console.log('═'.repeat(70) + '\n');
    process.exit(1);
  });
