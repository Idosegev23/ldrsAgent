/**
 * Test reading control table
 */

import { searchFiles, listFiles, getFileContent } from './src/integrations/connectors/drive.connector.js';

async function testReadControlTable() {
  console.log('\n📊 קריאת טבלת שליטה למיי שמן\n');

  // 1. Find the specific file
  const files = await searchFiles('טבלת שליטה || MY SHEMEN');
  const controlTable = files.find(f => 
    f.name.includes('MY SHEMEN') && 
    f.mimeType === 'application/vnd.google-apps.spreadsheet'
  );

  if (!controlTable) {
    console.log('❌ לא נמצא קובץ טבלת שליטה של MY SHEMEN');
    return;
  }

  console.log(`✅ נמצא קובץ: ${controlTable.name}`);
  console.log(`   ID: ${controlTable.id}`);
  console.log(`   סוג: ${controlTable.mimeType}\n`);

  // 2. Try to read the content
  console.log('📖 מנסה לקרוא תוכן...\n');
  
  try {
    const content = await getFileContent(controlTable.id);
    console.log(`✅ תוכן נקרא (${content.length} תווים):\n`);
    console.log(content.substring(0, 500));
    console.log('\n...\n');
  } catch (error: any) {
    console.log(`❌ שגיאה בקריאת תוכן: ${error.message}\n`);
    
    // Check if it's a Google Sheets file
    if (controlTable.mimeType === 'application/vnd.google-apps.spreadsheet') {
      console.log('💡 זה קובץ Google Sheets - צריך להשתמש ב-Sheets API!\n');
      console.log('📌 פתרון: צריך להוסיף תמיכה בקריאת Google Sheets\n');
    }
  }

  // 3. List files in "טבלאות שליטה" folder
  console.log('\n📂 חיפוש תיקיית "טבלאות שליטה"...\n');
  const folders = await searchFiles('טבלאות שליטה');
  const controlFolder = folders.find(f => 
    f.name === 'טבלאות שליטה' && 
    f.mimeType === 'application/vnd.google-apps.folder'
  );

  if (controlFolder) {
    console.log(`✅ נמצאה תיקייה: ${controlFolder.name}\n`);
    const filesInFolder = await listFiles(controlFolder.id);
    console.log(`📋 קבצים בתיקייה (${filesInFolder.length}):\n`);
    filesInFolder.forEach(f => {
      console.log(`   • ${f.name} (${f.mimeType})`);
    });
  }
}

testReadControlTable().catch(console.error);
