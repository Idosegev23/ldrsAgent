/**
 * 🔍 Verify Real Results - בדיקת תוצאות אמיתיות
 */

import * as drive from './src/integrations/connectors/drive.connector.js';
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

async function verifyResults() {
  console.log('\n' + '═'.repeat(70));
  console.log('🔍 בדיקת תוצאות אמיתיות');
  console.log('═'.repeat(70) + '\n');

  try {
    // 1. בדוק את ה-execution האחרון
    log('📊', 'בודק execution אחרון...', colors.blue);
    
    const { data: executions, error: execError } = await supabase
      .from('executions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3);

    if (execError) throw execError;

    console.log(`\n📋 ${executions?.length || 0} Executions אחרונים:\n`);
    executions?.forEach((exec: any, idx: number) => {
      console.log(`${idx + 1}. ${exec.id}`);
      console.log(`   Request: ${exec.request?.substring(0, 80)}...`);
      console.log(`   Status: ${exec.status}`);
      console.log(`   Created: ${exec.created_at}\n`);
    });

    // 2. בדוק את הצעדים שבוצעו
    log('👣', 'בודק צעדים שבוצעו...', colors.blue);
    
    const { data: steps, error: stepsError } = await supabase
      .from('execution_steps')
      .select('*')
      .order('step_number', { ascending: false })
      .limit(10);

    if (stepsError) throw stepsError;

    console.log(`\n📝 ${steps?.length || 0} צעדים אחרונים:\n`);
    steps?.forEach((step: any, idx: number) => {
      console.log(`${idx + 1}. ${step.agent_id} (Step ${step.step_number})`);
      console.log(`   Status: ${step.status}`);
      console.log(`   Execution: ${step.execution_id}`);
      if (step.output) {
        console.log(`   Output: ${JSON.stringify(step.output).substring(0, 100)}...`);
      }
      if (step.error) {
        console.log(`   ${colors.red}Error: ${step.error}${colors.reset}`);
      }
      console.log();
    });

    // 3. בדוק קבצים שנוצרו ב-Drive (אם יש file IDs)
    log('📁', 'בודק קבצים ב-Google Drive...', colors.blue);
    
    const fileIds = steps
      ?.filter((s: any) => s.output?.fileId)
      .map((s: any) => s.output.fileId) || [];

    if (fileIds.length > 0) {
      console.log(`\n🔍 נמצאו ${fileIds.length} File IDs, בודק...\n`);
      
      for (const fileId of fileIds) {
        try {
          log('🔎', `בודק קובץ: ${fileId}`, colors.cyan);
          
          const file = await drive.getFile(fileId);
          
          console.log(`   ✅ הקובץ קיים!`);
          console.log(`   📌 שם: ${file.name}`);
          console.log(`   📏 גודל: ${file.size || 0} bytes`);
          console.log(`   🕐 נוצר: ${file.createdTime}`);
          console.log(`   🔗 קישור: https://drive.google.com/file/d/${fileId}/view`);
          
          // נסה לקרוא את התוכן
          try {
            log('📖', 'קורא תוכן...', colors.blue);
            const content = await drive.readFileContent(fileId);
            
            console.log(`\n📄 תוכן הקובץ (${content.length} תווים):\n`);
            console.log('─'.repeat(70));
            console.log(content.substring(0, 1000)); // הצג את ה-1000 תווים הראשונים
            if (content.length > 1000) {
              console.log(`\n... (עוד ${content.length - 1000} תווים)`);
            }
            console.log('─'.repeat(70));
            
          } catch (readError: any) {
            log('⚠️', `לא הצלחתי לקרוא תוכן: ${readError.message}`, colors.yellow);
          }
          
          console.log();
          
        } catch (error: any) {
          log('❌', `הקובץ לא קיים! Error: ${error.message}`, colors.red);
          console.log();
        }
      }
    } else {
      log('⚠️', 'לא נמצאו file IDs בצעדים', colors.yellow);
    }

    // 4. בדוק חיפוש כללי ב-Drive
    log('🔍', 'מחפש קבצים שנוצרו לאחרונה...', colors.blue);
    
    try {
      // חיפוש קבצים שנוצרו בשעה האחרונה
      const recentFiles = await drive.listFiles(50);
      
      console.log(`\n📋 ${recentFiles.length} קבצים אחרונים ב-Drive:\n`);
      
      recentFiles.slice(0, 10).forEach((file: any, idx: number) => {
        console.log(`${idx + 1}. ${file.name}`);
        console.log(`   ID: ${file.id}`);
        console.log(`   Modified: ${file.modifiedTime}`);
        console.log(`   Size: ${file.size || 0} bytes`);
        console.log(`   🔗 https://drive.google.com/file/d/${file.id}/view\n`);
      });
      
    } catch (error: any) {
      log('⚠️', `לא הצלחתי לרשום קבצים: ${error.message}`, colors.yellow);
    }

    // 5. בדוק shared context
    log('🧠', 'בודק Shared Context...', colors.blue);
    
    const { data: contexts, error: contextError } = await supabase
      .from('shared_context')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (contextError) throw contextError;

    console.log(`\n📦 ${contexts?.length || 0} Context entries:\n`);
    contexts?.forEach((ctx: any, idx: number) => {
      console.log(`${idx + 1}. ${ctx.key} (by ${ctx.created_by})`);
      console.log(`   Value: ${JSON.stringify(ctx.value)}`);
      console.log(`   Execution: ${ctx.execution_id}\n`);
    });

    // סיכום
    console.log('\n' + '═'.repeat(70));
    log('📊', 'סיכום הבדיקה:', colors.cyan);
    console.log('═'.repeat(70) + '\n');

    console.log(`✅ Executions: ${executions?.length || 0}`);
    console.log(`✅ Steps: ${steps?.length || 0}`);
    console.log(`${fileIds.length > 0 ? '✅' : '❌'} קבצים ב-Drive: ${fileIds.length}`);
    console.log(`✅ Context entries: ${contexts?.length || 0}\n`);

    if (fileIds.length === 0) {
      log('⚠️', 'לא נוצרו קבצים אמיתיים ב-Drive!', colors.red);
      log('ℹ️', 'ייתכן שיש בעיית הרשאות או שה-upload נכשל', colors.yellow);
    }

  } catch (error) {
    console.error('\n❌ שגיאה בבדיקה:', error);
    throw error;
  }
}

verifyResults()
  .then(() => {
    console.log('\n✅ הבדיקה הסתיימה\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ הבדיקה נכשלה:', error);
    process.exit(1);
  });
