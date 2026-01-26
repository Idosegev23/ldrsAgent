/**
 * Test My Shemen folder search
 */

import { searchFiles, listFiles } from './src/integrations/connectors/drive.connector.js';

async function testMyShemen() {
  console.log('\n🔍 חיפוש תיקייה "מיי שמן"...\n');

  // 1. Find the folder
  const folders = await searchFiles('מיי שמן');
  const myShemenFolder = folders.find(f => 
    f.mimeType === 'application/vnd.google-apps.folder' && 
    f.name.includes('מיי שמן')
  );

  if (!myShemenFolder) {
    console.log('❌ לא נמצאה תיקייה "מיי שמן"');
    return;
  }

  console.log(`✅ נמצאה תיקייה: ${myShemenFolder.name} (${myShemenFolder.id})\n`);

  // 2. List files in the folder
  console.log('📂 קבצים בתיקייה:\n');
  const filesInFolder = await listFiles(myShemenFolder.id);
  
  console.log(`סה"כ ${filesInFolder.length} קבצים:\n`);
  filesInFolder.forEach((file, i) => {
    console.log(`${i + 1}. ${file.name}`);
    console.log(`   סוג: ${file.mimeType}`);
    console.log(`   ID: ${file.id}\n`);
  });

  // 3. Search for "שליטה" or "control"
  console.log('\n🔎 חיפוש "טבלת שליטה"...\n');
  const controlFiles = await searchFiles('שליטה');
  console.log(`נמצאו ${controlFiles.length} קבצים:\n`);
  controlFiles.slice(0, 10).forEach(file => {
    console.log(`• ${file.name} (${file.mimeType})`);
  });
}

testMyShemen().catch(console.error);
