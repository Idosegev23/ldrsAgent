/**
 * 🧪 Simple Database Test - בדיקה פשוטה של הדאטהבייס
 * 
 * מכניס נתונים לכל הטבלאות ובודק שהכל עובד
 */

import { supabase } from './src/db/client.js';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(emoji: string, message: string, color = colors.reset) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

async function testDatabase() {
  const executionId = `test_exec_${Date.now()}`;
  
  console.log('\n' + '═'.repeat(60));
  console.log('🧪 בדיקת דאטהבייס פשוטה');
  console.log('═'.repeat(60) + '\n');

  try {
    // 1. Insert execution
    log('📝', 'מכניס execution חדש...', colors.blue);
    const { data: execution, error: execError } = await supabase
      .from('executions')
      .insert({
        id: executionId,
        user_id: 'test_user_123',
        workspace_id: 'test_ws_001',
        request: 'תביא לי דוחות מהדרייב',
        status: 'RUNNING',
        current_step: 1,
        total_steps: 3,
        plan: {
          goal: 'להביא דוחות',
          strategy: 'parallel',
          steps: [
            { agent: 'drive', action: 'fetch' },
            { agent: 'analyzer', action: 'analyze' },
            { agent: 'reporter', action: 'report' }
          ]
        }
      })
      .select()
      .single();

    if (execError) throw execError;
    log('✅', `Execution נוצר: ${executionId}`, colors.green);

    // 2. Insert steps
    log('📝', 'מכניס צעדים...', colors.blue);
    const steps = [
      {
        id: `${executionId}_step1`,
        execution_id: executionId,
        step_number: 1,
        agent_id: 'drive_agent',
        status: 'COMPLETED',
        input: { folder: 'דוחות 2024' },
        output: { files: ['דוח1.pdf', 'דוח2.pdf'], count: 2 },
        duration_ms: 1500,
        tokens_used: 250
      },
      {
        id: `${executionId}_step2`,
        execution_id: executionId,
        step_number: 2,
        agent_id: 'analyzer_agent',
        status: 'RUNNING',
        input: { files: ['דוח1.pdf', 'דוח2.pdf'] },
        duration_ms: null,
        tokens_used: null
      }
    ];

    const { error: stepsError } = await supabase
      .from('execution_steps')
      .insert(steps);

    if (stepsError) throw stepsError;
    log('✅', `${steps.length} צעדים נוצרו`, colors.green);

    // 3. Insert shared context
    log('📝', 'מכניס shared context...', colors.blue);
    const { error: contextError } = await supabase
      .from('shared_context')
      .insert([
        {
          execution_id: executionId,
          key: 'files_found',
          value: { count: 2, names: ['דוח1.pdf', 'דוח2.pdf'] },
          created_by: 'drive_agent'
        },
        {
          execution_id: executionId,
          key: 'drive_folder_id',
          value: { id: 'folder_12345', path: '/דוחות 2024' },
          created_by: 'drive_agent'
        }
      ]);

    if (contextError) throw contextError;
    log('✅', 'Context נוצר', colors.green);

    // 4. Insert logs
    log('📝', 'מכניס לוגים...', colors.blue);
    const { error: logsError } = await supabase
      .from('logs')
      .insert([
        {
          id: `${executionId}_log1`,
          execution_id: executionId,
          source: 'drive_agent',
          level: 'INFO',
          message: 'התחלתי לחפש קבצים בתיקייה',
          metadata: { folder: 'דוחות 2024' }
        },
        {
          id: `${executionId}_log2`,
          execution_id: executionId,
          source: 'drive_agent',
          level: 'INFO',
          message: 'מצאתי 2 קבצים',
          metadata: { count: 2 }
        },
        {
          id: `${executionId}_log3`,
          execution_id: executionId,
          source: 'analyzer_agent',
          level: 'INFO',
          message: 'מתחיל לנתח קובץ ראשון',
          metadata: { file: 'דוח1.pdf' }
        }
      ]);

    if (logsError) throw logsError;
    log('✅', '3 לוגים נוצרו', colors.green);

    // 5. Insert metrics
    log('📝', 'מכניס מטריקות...', colors.blue);
    const { error: metricsError } = await supabase
      .from('metrics')
      .insert([
        {
          id: `${executionId}_metric1`,
          metric_name: 'execution_duration_ms',
          metric_value: 1500,
          tags: { execution_id: executionId, agent: 'drive_agent' }
        },
        {
          id: `${executionId}_metric2`,
          metric_name: 'tokens_used',
          metric_value: 250,
          tags: { execution_id: executionId, step: 1 }
        }
      ]);

    if (metricsError) throw metricsError;
    log('✅', 'מטריקות נוצרו', colors.green);

    // 6. Insert cache entry
    log('📝', 'מכניס cache...', colors.blue);
    const { error: cacheError } = await supabase
      .from('cache_entries')
      .insert({
        key: 'drive_folder_list_דוחות_2024',
        value: { files: ['דוח1.pdf', 'דוח2.pdf'], cached_at: new Date().toISOString() },
        ttl_seconds: 3600,
        expires_at: new Date(Date.now() + 3600000).toISOString()
      });

    if (cacheError) throw cacheError;
    log('✅', 'Cache נוצר', colors.green);

    // Now query everything back
    console.log('\n' + '═'.repeat(60));
    console.log('📊 קורא את הנתונים שנוצרו...');
    console.log('═'.repeat(60) + '\n');

    // Query execution
    const { data: savedExecution } = await supabase
      .from('executions')
      .select('*')
      .eq('id', executionId)
      .single();

    log('📋', 'Execution:', colors.cyan);
    console.log(JSON.stringify(savedExecution, null, 2));

    // Query steps
    const { data: savedSteps } = await supabase
      .from('execution_steps')
      .select('*')
      .eq('execution_id', executionId)
      .order('step_number', { ascending: true });

    log('\n📋', `Steps (${savedSteps?.length || 0}):`, colors.cyan);
    savedSteps?.forEach((step: any) => {
      console.log(`  ${step.step_number}. ${step.agent_id} - ${step.status}`);
    });

    // Query context
    const { data: savedContext } = await supabase
      .from('shared_context')
      .select('*')
      .eq('execution_id', executionId);

    log('\n📋', `Context (${savedContext?.length || 0}):`, colors.cyan);
    savedContext?.forEach((ctx: any) => {
      console.log(`  • ${ctx.key}: ${JSON.stringify(ctx.value)}`);
    });

    // Query logs
    const { data: savedLogs } = await supabase
      .from('logs')
      .select('*')
      .eq('execution_id', executionId)
      .order('timestamp', { ascending: true });

    log('\n📋', `Logs (${savedLogs?.length || 0}):`, colors.cyan);
    savedLogs?.forEach((logEntry: any) => {
      console.log(`  [${logEntry.level}] ${logEntry.message}`);
    });

    console.log('\n' + '═'.repeat(60));
    log('✅', 'הבדיקה הושלמה בהצלחה! כל הטבלאות עובדות!', colors.green);
    console.log('═'.repeat(60) + '\n');

  } catch (error) {
    console.log('\n' + '═'.repeat(60));
    log('❌', 'שגיאה בבדיקה:', colors.red);
    console.error(error);
    console.log('═'.repeat(60) + '\n');
    process.exit(1);
  }
}

testDatabase();
