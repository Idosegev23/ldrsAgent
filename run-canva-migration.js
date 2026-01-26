/**
 * Run Canva Migration
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = 'https://fhgggqnaplshwbrzgima.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoZ2dncW5hcGxzaHdicnpnaW1hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDY3NDM5OCwiZXhwIjoyMDgwMjUwMzk4fQ.rCE3_Scz9nxgQUQzssslGcVS-s15MsGiMIpLlGe4YNY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🎨 מריץ מיגרציה Canva...\n');

  try {
    const sql = readFileSync('./src/db/migrations/007_add_canva_oauth.sql', 'utf8');
    
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));

    console.log(`⚙️  מבצע ${statements.length} פקודות...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql_string: statement });
        
        if (error) {
          if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            console.log(`   ⚠️  ${i + 1}/${statements.length} - כבר קיים (OK)`);
          } else {
            console.log(`   ❌ ${i + 1}/${statements.length} - שגיאה: ${error.message}`);
          }
        } else {
          console.log(`   ✓ ${i + 1}/${statements.length} הושלם`);
        }
      } catch (err) {
        console.log(`   ⚠️  ${i + 1}/${statements.length} - ${err.message}`);
      }
    }

    console.log('\n✅ המיגרציה הסתיימה!\n');
    
    // בדיקה
    const { data, error } = await supabase
      .from('users')
      .select('canva_access_token, canva_user_id')
      .limit(1);
      
    if (!error) {
      console.log('✅ אימות: עמודות Canva נוצרו בהצלחה!\n');
    } else {
      console.log('⚠️  שגיאה באימות:', error.message);
    }

  } catch (error) {
    console.error('❌ שגיאה:', error);
    process.exit(1);
  }
}

runMigration();
