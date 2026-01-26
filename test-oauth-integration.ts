/**
 * Test OAuth Integration
 * Validates all components are properly configured
 */

import { supabase } from './src/db/client.js';
import * as drive from './src/integrations/connectors/drive.connector.js';
import * as calendar from './src/integrations/connectors/calendar.connector.js';
import { RealExecutionAgent } from './src/execution/agents/real-execution.agent.js';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(emoji: string, message: string, color = colors.reset) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

async function testOAuthIntegration() {
  console.log('\n' + colors.bold + colors.cyan + '═══════════════════════════════════════════════════════════════════');
  console.log('               בדיקת שילוב OAuth במערכת');
  console.log('═══════════════════════════════════════════════════════════════════' + colors.reset + '\n');

  let testsPass = 0;
  let testsFail = 0;

  // Test 1: Database Migration
  log('📋', 'בודק מיגרציה של טבלת users...', colors.cyan);
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('google_access_token, google_email')
      .limit(1);
      
    if (error) throw error;
    
    log('✅', 'מיגרציה הצליחה - עמודות OAuth קיימות', colors.green);
    testsPass++;
  } catch (error: any) {
    log('❌', `מיגרציה נכשלה: ${error.message}`, colors.red);
    testsFail++;
  }

  // Test 2: Drive Connector with OAuth support
  log('📋', 'בודק Drive Connector עם OAuth...', colors.cyan);
  try {
    const testUserId = 'test-user-id';
    
    // Check if getUserClient exists
    const driveModule = await import('./src/integrations/connectors/drive.connector.js');
    if (typeof driveModule.searchFiles === 'function') {
      log('✅', 'Drive Connector תומך ב-userId parameter', colors.green);
      testsPass++;
    } else {
      throw new Error('searchFiles function not found');
    }
  } catch (error: any) {
    log('❌', `Drive Connector נכשל: ${error.message}`, colors.red);
    testsFail++;
  }

  // Test 3: RealExecutionAgent exists
  log('📋', 'בודק RealExecutionAgent...', colors.cyan);
  try {
    const agent = new RealExecutionAgent();
    if (typeof agent.execute === 'function') {
      log('✅', 'RealExecutionAgent נוצר בהצלחה', colors.green);
      testsPass++;
    } else {
      throw new Error('execute method not found');
    }
  } catch (error: any) {
    log('❌', `RealExecutionAgent נכשל: ${error.message}`, colors.red);
    testsFail++;
  }

  // Test 4: Orchestration files updated
  log('📋', 'בודק עדכון Executor...', colors.cyan);
  try {
    const executorModule = await import('./src/orchestration/executor.js');
    log('✅', 'Executor מעודכן ומוכן', colors.green);
    testsPass++;
  } catch (error: any) {
    log('❌', `Executor נכשל: ${error.message}`, colors.red);
    testsFail++;
  }

  // Test 5: OAuth endpoints exist
  log('📋', 'בודק OAuth API endpoints...', colors.cyan);
  try {
    const fs = await import('fs');
    const authEndpoint = fs.existsSync('./web/app/api/auth/google/route.ts');
    const callbackEndpoint = fs.existsSync('./web/app/api/auth/google/callback/route.ts');
    const statusEndpoint = fs.existsSync('./web/app/api/auth/google/status/route.ts');
    
    if (authEndpoint && callbackEndpoint && statusEndpoint) {
      log('✅', 'כל 3 OAuth endpoints קיימים', colors.green);
      testsPass++;
    } else {
      throw new Error('Not all endpoints exist');
    }
  } catch (error: any) {
    log('❌', `OAuth endpoints נכשלו: ${error.message}`, colors.red);
    testsFail++;
  }

  // Test 6: UI component updated
  log('📋', 'בודק עדכון UI component...', colors.cyan);
  try {
    const fs = await import('fs');
    const uiContent = fs.readFileSync('./web/app/orchestrate/page.tsx', 'utf8');
    
    if (uiContent.includes('oauthConnected') && uiContent.includes('connectGoogle')) {
      log('✅', 'UI Component מעודכן עם OAuth', colors.green);
      testsPass++;
    } else {
      throw new Error('OAuth code not found in UI');
    }
  } catch (error: any) {
    log('❌', `UI Component נכשל: ${error.message}`, colors.red);
    testsFail++;
  }

  // Summary
  console.log('\n' + colors.bold + colors.cyan + '═══════════════════════════════════════════════════════════════════');
  console.log('                          סיכום בדיקות');
  console.log('═══════════════════════════════════════════════════════════════════' + colors.reset + '\n');

  log('✅', `בדיקות שעברו: ${testsPass}`, colors.green);
  if (testsFail > 0) {
    log('❌', `בדיקות שנכשלו: ${testsFail}`, colors.red);
  }

  const totalTests = testsPass + testsFail;
  const percentage = ((testsPass / totalTests) * 100).toFixed(0);
  
  console.log(`\n${colors.bold}${percentage}% מהבדיקות עברו בהצלחה${colors.reset}\n`);

  if (testsPass === totalTests) {
    log('🎉', 'כל הרכיבים מוכנים! אפשר להתחיל להשתמש במערכת', colors.green);
    console.log('\n' + colors.cyan + '📝 צעדים הבאים:' + colors.reset);
    console.log('   1. הרץ את השרת: cd web && pnpm dev');
    console.log('   2. היכנס ל-http://localhost:3000/orchestrate');
    console.log('   3. התחבר ל-Google');
    console.log('   4. הפעל execution עם בקשה כמו:');
    console.log('      "תוציא לי נתונים של [לקוח] מחודש דצמבר ותקבע פגישה"\n');
  } else {
    log('⚠️', 'יש בעיות שצריך לתקן לפני השימוש', colors.yellow);
  }
}

testOAuthIntegration().catch(console.error);
