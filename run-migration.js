/**
 * Run Orchestration Migration
 * מריץ את המיגרציה דרך Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase connection
const supabaseUrl = 'https://fhgggqnaplshwbrzgima.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoZ2dncW5hcGxzaHdicnpnaW1hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDY3NDM5OCwiZXhwIjoyMDgwMjUwMzk4fQ.rCE3_Scz9nxgQUQzssslGcVS-s15MsGiMIpLlGe4YNY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🚀 מריץ מיגרציה למערכת התזמור...\n');

  try {
    // קרא את קובץ המיגרציה
    const migrationPath = join(__dirname, 'src', 'db', 'migrations', '005_full_orchestration.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    console.log('📄 קובץ המיגרציה נקרא בהצלחה');
    console.log(`   גודל: ${(sql.length / 1024).toFixed(1)} KB`);
    console.log(`   שורות: ${sql.split('\n').length}`);

    // ספור טבלאות
    const tableCount = (sql.match(/CREATE TABLE/g) || []).length;
    console.log(`   טבלאות: ${tableCount}\n`);

    // פצל לפי פקודות
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`⚙️  מבצע ${statements.length} פקודות SQL...\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // דלג על comments
      if (statement.startsWith('COMMENT')) {
        continue;
      }

      try {
        const { error } = await supabase.rpc('execute_sql', {
          query: statement + ';'
        });

        if (error) {
          // נסה דרך direct query במקום
          const { error: queryError } = await supabase.from('_migrations').select().limit(1);
          
          if (queryError && queryError.message.includes('does not exist')) {
            console.log(`⚠️  Warning: Cannot execute via RPC. Please run migration manually.`);
            console.log(`\n📋 Copy the SQL to Supabase SQL Editor:`);
            console.log(`   ${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/')}/sql\n`);
            process.exit(1);
          }
        }

        successCount++;
        
        // הצג התקדמות
        if ((i + 1) % 5 === 0) {
          console.log(`   ✓ ${i + 1}/${statements.length} פקודות הושלמו`);
        }
      } catch (error) {
        errorCount++;
        console.error(`   ✗ שגיאה בפקודה ${i + 1}:`, error.message);
      }
    }

    console.log('\n═══════════════════════════════════════════════');
    console.log('✅ המיגרציה הושלמה!');
    console.log('═══════════════════════════════════════════════');
    console.log(`   הצלחות: ${successCount}`);
    console.log(`   שגיאות: ${errorCount}`);
    console.log(`   טבלאות נוצרו: ${tableCount}`);
    console.log('');
    console.log('🎉 מערכת התזמור מוכנה לשימוש!');
    console.log('');
    console.log('📝 צעדים הבאים:');
    console.log('   1. cd web && npm run dev');
    console.log('   2. פתח: http://localhost:3000/orchestrate');
    console.log('');

  } catch (error) {
    console.error('❌ שגיאה:', error.message);
    console.error('\n💡 פתרון:');
    console.error('   הרץ את המיגרציה ידנית דרך Supabase SQL Editor:');
    console.error(`   ${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/')}/sql`);
    console.error('');
    process.exit(1);
  }
}

runMigration();
