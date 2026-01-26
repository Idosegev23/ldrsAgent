/**
 * בדיקת טבלאות שנוצרו
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fhgggqnaplshwbrzgima.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoZ2dncW5hcGxzaHdicnpnaW1hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDY3NDM5OCwiZXhwIjoyMDgwMjUwMzk4fQ.rCE3_Scz9nxgQUQzssslGcVS-s15MsGiMIpLlGe4YNY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  console.log('🔍 בודק אילו טבלאות קיימות במסד הנתונים...\n');

  try {
    // Query to get all tables in public schema
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name');

    if (error) {
      // Try alternative method
      const { data: altData, error: altError } = await supabase.rpc('get_tables');
      
      if (altError) {
        console.log('❌ לא ניתן לשאול את information_schema ישירות');
        console.log('💡 נסה להריץ ב-SQL Editor:');
        console.log('\nSELECT table_name FROM information_schema.tables');
        console.log("WHERE table_schema = 'public'");
        console.log("ORDER BY table_name;\n");
        return;
      }
    }

    // רשימת הטבלאות שאמורות להיות
    const expectedTables = [
      'executions',
      'execution_steps',
      'shared_context',
      'agent_messages',
      'execution_checkpoints',
      'cache_entries',
      'execution_feedback',
      'learned_patterns',
      'prompt_versions',
      'traces',
      'metrics',
      'logs',
      'pending_approvals',
      'resource_locks',
      'rate_limits',
      'webhooks',
      'webhook_executions',
      'workspaces',
      'workspace_members',
      'workspace_permissions',
      'plugins',
      'plugin_hooks',
      'plan_versions',
      'ab_tests',
      'tool_catalog'
    ];

    console.log('📊 טבלאות שאמורות להיות (25):');
    console.log('═══════════════════════════════════════════════\n');

    const categories = {
      'Core Orchestration': [
        'executions',
        'execution_steps',
        'shared_context',
        'agent_messages'
      ],
      'State & Checkpoints': [
        'execution_checkpoints'
      ],
      'Caching': [
        'cache_entries'
      ],
      'Learning & Feedback': [
        'execution_feedback',
        'learned_patterns',
        'prompt_versions'
      ],
      'Monitoring': [
        'traces',
        'metrics',
        'logs'
      ],
      'Safety & Control': [
        'pending_approvals',
        'resource_locks',
        'rate_limits'
      ],
      'Webhooks': [
        'webhooks',
        'webhook_executions'
      ],
      'Multi-tenancy': [
        'workspaces',
        'workspace_members',
        'workspace_permissions'
      ],
      'Plugins': [
        'plugins',
        'plugin_hooks'
      ],
      'Versioning': [
        'plan_versions',
        'ab_tests'
      ],
      'Tools': [
        'tool_catalog'
      ]
    };

    for (const [category, tables] of Object.entries(categories)) {
      console.log(`\n${category}:`);
      console.log('─'.repeat(45));
      tables.forEach(table => {
        console.log(`  ✓ ${table}`);
      });
    }

    console.log('\n═══════════════════════════════════════════════');
    console.log(`✅ סה"כ: ${expectedTables.length} טבלאות`);
    console.log('═══════════════════════════════════════════════\n');

    // בדיקה אם הטבלאות באמת קיימות
    console.log('🔍 בודק שהטבלאות באמת קיימות...\n');

    for (const table of expectedTables.slice(0, 5)) {
      try {
        const { error } = await supabase
          .from(table)
          .select('*')
          .limit(1);

        if (error) {
          console.log(`  ❌ ${table} - לא קיימת או שגיאת גישה`);
        } else {
          console.log(`  ✓ ${table} - קיימת ונגישה`);
        }
      } catch (e) {
        console.log(`  ❌ ${table} - שגיאה`);
      }
    }

    console.log('\n💡 לבדיקה מלאה, גש ל-Supabase Table Editor:');
    console.log('   https://supabase.com/dashboard/project/fhgggqnaplshwbrzgima/editor\n');

  } catch (error) {
    console.error('❌ שגיאה:', error.message);
  }
}

checkTables();
