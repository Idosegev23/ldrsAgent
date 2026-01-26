/**
 * אימות טבלאות
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fhgggqnaplshwbrzgima.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoZ2dncW5hcGxzaHdicnpnaW1hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDY3NDM5OCwiZXhwIjoyMDgwMjUwMzk4fQ.rCE3_Scz9nxgQUQzssslGcVS-s15MsGiMIpLlGe4YNY';

const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
  { name: 'executions', category: 'Core Orchestration', description: 'רשומות ביצוע ראשיות' },
  { name: 'execution_steps', category: 'Core Orchestration', description: 'צעדי ביצוע בודדים' },
  { name: 'shared_context', category: 'Core Orchestration', description: 'נתונים משותפים בין agents' },
  { name: 'agent_messages', category: 'Core Orchestration', description: 'הודעות בין-סוכניות' },
  { name: 'execution_checkpoints', category: 'State Persistence', description: 'נקודות שחזור' },
  { name: 'cache_entries', category: 'Caching', description: 'תוצאות cached' },
  { name: 'execution_feedback', category: 'Learning', description: 'משוב ומטריקות ביצוע' },
  { name: 'learned_patterns', category: 'Learning', description: 'patterns שהמערכת למדה' },
  { name: 'prompt_versions', category: 'Learning', description: 'גרסאות prompts' },
  { name: 'traces', category: 'Monitoring', description: 'Distributed tracing spans' },
  { name: 'metrics', category: 'Monitoring', description: 'מטריקות ביצועים' },
  { name: 'logs', category: 'Monitoring', description: 'לוגים מרוכזים' },
  { name: 'pending_approvals', category: 'Safety', description: 'בקשות אישור' },
  { name: 'resource_locks', category: 'Safety', description: 'נעילות משאבים' },
  { name: 'rate_limits', category: 'Safety', description: 'מגבלות API' },
  { name: 'webhooks', category: 'Webhooks', description: 'הגדרות webhooks' },
  { name: 'webhook_executions', category: 'Webhooks', description: 'היסטוריית הרצות webhooks' },
  { name: 'workspaces', category: 'Multi-tenancy', description: 'מרחבי עבודה' },
  { name: 'workspace_members', category: 'Multi-tenancy', description: 'חברי workspace' },
  { name: 'workspace_permissions', category: 'Multi-tenancy', description: 'הרשאות workspace' },
  { name: 'plugins', category: 'Plugins', description: 'תוספים מותקנים' },
  { name: 'plugin_hooks', category: 'Plugins', description: 'hooks של plugins' },
  { name: 'plan_versions', category: 'Versioning', description: 'גרסאות תוכנית' },
  { name: 'ab_tests', category: 'Versioning', description: 'בדיקות A/B' },
  { name: 'tool_catalog', category: 'Tools', description: 'קטלוג כלים שהתגלו' }
];

console.log('🗄️ רשימת 25 הטבלאות שנוצרו במיגרציה');
console.log('═══════════════════════════════════════════════════════════\n');

async function verifyTables() {
  let existingCount = 0;
  const categories = {};

  for (const table of tables) {
    try {
      const { error, count } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true });

      if (!error) {
        existingCount++;
        if (!categories[table.category]) {
          categories[table.category] = [];
        }
        categories[table.category].push({
          ...table,
          exists: true,
          rowCount: count || 0
        });
      } else {
        if (!categories[table.category]) {
          categories[table.category] = [];
        }
        categories[table.category].push({
          ...table,
          exists: false
        });
      }
    } catch (e) {
      if (!categories[table.category]) {
        categories[table.category] = [];
      }
      categories[table.category].push({
        ...table,
        exists: false
      });
    }
  }

  // הצג לפי קטגוריות
  for (const [category, tables] of Object.entries(categories)) {
    console.log(`\n📁 ${category}`);
    console.log('─'.repeat(60));
    
    for (const table of tables) {
      const status = table.exists ? '✅' : '❌';
      const count = table.exists && table.rowCount !== undefined 
        ? ` (${table.rowCount} rows)` 
        : '';
      
      console.log(`  ${status} ${table.name}${count}`);
      console.log(`     ${table.description}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`📊 סיכום: ${existingCount}/${tables.length} טבלאות קיימות ונגישות`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (existingCount === tables.length) {
    console.log('🎉 מושלם! כל הטבלאות קיימות!');
    console.log('\n📝 צעדים הבאים:');
    console.log('   1. cd web && npm run dev');
    console.log('   2. פתח: http://localhost:3000/orchestrate');
  } else if (existingCount > 0) {
    console.log(`⚠️  קיימות ${existingCount} טבלאות מתוך ${tables.length}`);
    console.log('   אולי המיגרציה הצליחה חלקית');
  } else {
    console.log('❌ אין טבלאות - המיגרציה לא רצה');
    console.log('💡 הרץ שוב: node run-migration.js');
  }
  
  console.log('');
}

verifyTables();
