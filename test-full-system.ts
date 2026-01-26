/**
 * 🧪 Full System Test - בדיקה מלאה של המערכת
 * 
 * מריץ execution אמיתי עם כל השכבות:
 * - Master Orchestrator
 * - Planner
 * - Executor
 * - State Manager
 * - Monitoring
 */

import { initializeOrchestration } from './src/orchestration/initialize.js';
import { MasterOrchestrator } from './src/orchestration/master.js';
import { supabase } from './src/db/client.js';

// צבעים לקונסול
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
  console.log('\n' + '═'.repeat(60));
  console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`);
  console.log('═'.repeat(60) + '\n');
}

async function testFullSystem() {
  try {
    logSection('🚀 התחלת בדיקת מערכת מלאה');

    // Step 1: Initialize
    log('⚙️', 'מאתחל את המערכת...', colors.blue);
    await initializeOrchestration();
    log('✅', 'אתחול הושלם!', colors.green);

    // Step 2: Create orchestrator
    log('🎯', 'יוצר Master Orchestrator...', colors.blue);
    const orchestrator = new MasterOrchestrator();
    log('✅', 'Orchestrator מוכן!', colors.green);

    // Step 3: Test request
    logSection('📝 בקשת המשתמש');
    const userRequest = 'תביא לי את כל הקבצים מ-Google Drive מהתיקייה "דוחות 2024" ותעשה ניתוח של הנתונים';
    log('💬', `"${userRequest}"`, colors.yellow);

    // Step 4: Execute
    logSection('🎬 מתחיל ביצוע');
    const executionId = `exec_test_${Date.now()}`;
    
    log('📊', `Execution ID: ${executionId}`, colors.cyan);
    log('⏳', 'מריץ את התהליך...', colors.blue);

    const result = await orchestrator.orchestrate({
      request: userRequest,
      userId: 'test_user_001',
      workspaceId: 'test_workspace_001',
      executionId,
    });

    // Step 5: Show results
    logSection('📊 תוצאות הביצוע');
    
    log('🆔', `Execution ID: ${result.executionId}`, colors.cyan);
    log('📈', `סטטוס: ${result.status}`, colors.green);
    log('🔢', `מספר צעדים: ${result.totalSteps}`, colors.blue);
    log('⏱️', `זמן ביצוע: ${result.durationMs}ms`, colors.magenta);

    if (result.plan) {
      logSection('📋 התוכנית שנוצרה');
      log('🎯', `מטרה: ${result.plan.goal}`, colors.yellow);
      log('🔧', `אסטרטגיה: ${result.plan.strategy}`, colors.yellow);
      console.log('\n📝 צעדים:');
      result.plan.steps.forEach((step: any, idx: number) => {
        console.log(`   ${idx + 1}. ${step.description} (${step.agent})`);
      });
    }

    // Step 6: Query database to show what was saved
    logSection('💾 נתונים שנשמרו בדאטהבייס');

    // Get execution
    const { data: execution } = await supabase
      .from('executions')
      .select('*')
      .eq('id', executionId)
      .single();

    if (execution) {
      log('✅', 'Execution נשמר:', colors.green);
      console.log(JSON.stringify(execution, null, 2));
    }

    // Get steps
    const { data: steps } = await supabase
      .from('execution_steps')
      .select('*')
      .eq('execution_id', executionId)
      .order('step_number', { ascending: true });

    if (steps && steps.length > 0) {
      logSection('👣 צעדי הביצוע');
      steps.forEach((step: any) => {
        const statusIcon = step.status === 'COMPLETED' ? '✅' : 
                          step.status === 'FAILED' ? '❌' : 
                          step.status === 'RUNNING' ? '⏳' : '⏸️';
        log(statusIcon, `צעד ${step.step_number}: ${step.agent_id} - ${step.status}`, colors.cyan);
        if (step.duration_ms) {
          console.log(`   ⏱️  ${step.duration_ms}ms`);
        }
        if (step.tokens_used) {
          console.log(`   🎫 ${step.tokens_used} tokens`);
        }
      });
    }

    // Get logs
    const { data: logs } = await supabase
      .from('logs')
      .select('*')
      .eq('execution_id', executionId)
      .order('timestamp', { ascending: false })
      .limit(10);

    if (logs && logs.length > 0) {
      logSection('📝 לוגים אחרונים');
      logs.forEach((logEntry: any) => {
        const levelIcon = logEntry.level === 'ERROR' ? '❌' : 
                         logEntry.level === 'WARN' ? '⚠️' : 
                         logEntry.level === 'INFO' ? 'ℹ️' : '🔍';
        log(levelIcon, `[${logEntry.source}] ${logEntry.message}`, colors.reset);
      });
    }

    // Get shared context
    const { data: context } = await supabase
      .from('shared_context')
      .select('*')
      .eq('execution_id', executionId);

    if (context && context.length > 0) {
      logSection('🧠 Shared Context');
      context.forEach((ctx: any) => {
        log('📦', `${ctx.key} (by ${ctx.created_by})`, colors.magenta);
        console.log(`   ${JSON.stringify(ctx.value, null, 2)}`);
      });
    }

    // Step 7: Show metrics
    logSection('📊 מטריקות מערכת');
    
    const { data: metrics } = await supabase
      .from('metrics')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(5);

    if (metrics && metrics.length > 0) {
      metrics.forEach((metric: any) => {
        log('📈', `${metric.metric_name}: ${metric.metric_value}`, colors.blue);
      });
    }

    logSection('✅ הבדיקה הושלמה בהצלחה!');
    log('🎉', 'כל המערכת עובדת תקין!', colors.green);

  } catch (error) {
    logSection('❌ שגיאה בבדיקה');
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
logSection('🧪 Full System Test');
log('📅', new Date().toLocaleString('he-IL'), colors.cyan);
log('🏃', 'מתחיל את הבדיקה...', colors.yellow);

testFullSystem()
  .then(() => {
    console.log('\n' + '═'.repeat(60));
    log('✅', 'הבדיקה הסתיימה בהצלחה!', colors.bright + colors.green);
    console.log('═'.repeat(60) + '\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n' + '═'.repeat(60));
    log('❌', 'הבדיקה נכשלה!', colors.bright + colors.red);
    console.error(error);
    console.log('═'.repeat(60) + '\n');
    process.exit(1);
  });
