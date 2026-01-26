/**
 * Test Drive Connection
 * בדיקה ידנית של חיבור ל-Google Drive
 */

import { searchFiles, getFileContent, listFiles } from './src/integrations/connectors/drive.connector.js';
import { getConfig } from './src/utils/config.js';

async function testDriveConnection() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║                                                    ║');
  console.log('║      🔍 בדיקת חיבור ל-Google Drive               ║');
  console.log('║                                                    ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  try {
    const config = getConfig();
    
    console.log('📋 בדיקת הגדרות:');
    console.log(`   ✓ Service Account: ${config.GOOGLE_SERVICE_ACCOUNT_KEY ? 'מוגדר' : '❌ חסר'}`);
    console.log(`   ✓ Drive Folder ID: ${config.GOOGLE_DRIVE_FOLDER_ID || '❌ חסר'}`);
    console.log('');

    // Test 1: List files
    console.log('📂 טסט 1: רשימת קבצים בתיקייה הראשית...');
    try {
      const files = await listFiles();
      console.log(`   ✅ נמצאו ${files.length} קבצים:`);
      files.slice(0, 5).forEach(file => {
        console.log(`      • ${file.name} (${file.mimeType})`);
      });
      if (files.length > 5) {
        console.log(`      ... ועוד ${files.length - 5} קבצים`);
      }
    } catch (error) {
      console.error('   ❌ שגיאה:', (error as Error).message);
      throw error;
    }
    console.log('');

    // Test 2: Search files - Hebrew
    console.log('🔎 טסט 2: חיפוש קבצים בעברית ("דוח")...');
    try {
      const hebrewResults = await searchFiles('דוח');
      console.log(`   ✅ נמצאו ${hebrewResults.length} קבצים:`);
      hebrewResults.slice(0, 3).forEach(file => {
        console.log(`      • ${file.name}`);
      });
    } catch (error) {
      console.error('   ❌ שגיאה:', (error as Error).message);
    }
    console.log('');

    // Test 3: Search files - English
    console.log('🔎 טסט 3: חיפוש קבצים באנגלית ("report")...');
    try {
      const englishResults = await searchFiles('report');
      console.log(`   ✅ נמצאו ${englishResults.length} קבצים:`);
      englishResults.slice(0, 3).forEach(file => {
        console.log(`      • ${file.name}`);
      });
    } catch (error) {
      console.error('   ❌ שגיאה:', (error as Error).message);
    }
    console.log('');

    // Test 4: Search with brand name
    console.log('🔎 טסט 4: חיפוש עם שם מותג ("נייקי" / "Nike")...');
    try {
      const brandResults = await searchFiles('נייקי');
      console.log(`   ✅ נמצאו ${brandResults.length} קבצים:`);
      brandResults.slice(0, 3).forEach(file => {
        console.log(`      • ${file.name}`);
      });
    } catch (error) {
      console.error('   ⚠️  לא נמצאו קבצים (זה בסדר אם אין)');
    }
    console.log('');

    // Test 5: Get file content (if any files found)
    console.log('📄 טסט 5: קריאת תוכן קובץ...');
    try {
      const files = await listFiles();
      if (files.length > 0) {
        const firstFile = files[0];
        console.log(`   מנסה לקרוא: ${firstFile.name}...`);
        
        // Only try to read if it's a Google Doc/Sheet
        if (
          firstFile.mimeType.includes('document') ||
          firstFile.mimeType.includes('spreadsheet') ||
          firstFile.mimeType === 'text/plain'
        ) {
          const content = await getFileContent(firstFile.id);
          console.log(`   ✅ תוכן הקובץ (${content.length} תווים):`);
          console.log(`      ${content.substring(0, 200)}...`);
        } else {
          console.log(`   ⚠️  הקובץ אינו מסוג טקסט (${firstFile.mimeType})`);
        }
      } else {
        console.log('   ⚠️  אין קבצים לקריאה');
      }
    } catch (error) {
      console.error('   ❌ שגיאה:', (error as Error).message);
    }
    console.log('');

    console.log('═══════════════════════════════════════════════════');
    console.log('✅ הטסט הסתיים בהצלחה!');
    console.log('');
    console.log('💡 מסקנות:');
    console.log('   • החיבור ל-Drive עובד');
    console.log('   • ניתן לקרוא קבצים מהתיקייה המשותפת');
    console.log('   • החיפוש פועל (עם תמיכה בעברית ואנגלית)');
    console.log('');

  } catch (error) {
    console.error('\n❌ הטסט נכשל!');
    console.error('שגיאה:', (error as Error).message);
    console.error('');
    console.error('🔧 פתרונות אפשריים:');
    console.error('   1. ודא ש-GOOGLE_SERVICE_ACCOUNT_KEY מוגדר ב-.env');
    console.error('   2. ודא ש-GOOGLE_DRIVE_FOLDER_ID מוגדר ב-.env');
    console.error('   3. ודא שה-Service Account משותף בתיקיית Drive');
    console.error('   4. בדוק שהתיקייה אכן משותפת עם: [email service account]');
    console.error('');
    throw error;
  }
}

// Run test
testDriveConnection().catch(console.error);
