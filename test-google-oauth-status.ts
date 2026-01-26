/**
 * Test Google OAuth Status
 * בדיקה אם המשתמש מחובר ב-Google OAuth
 */

import { getUserGoogleInfo } from './src/integrations/auth/google-oauth.js';

async function testGoogleOAuthStatus() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║                                                    ║');
  console.log('║      🔐 בדיקת סטטוס Google OAuth                 ║');
  console.log('║                                                    ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  // You need to replace this with your actual user ID
  // You can get it from the Supabase `users` table
  const userId = 'YOUR_USER_ID_HERE'; // TODO: Replace with actual user ID

  console.log(`📋 בודק סטטוס OAuth עבור משתמש: ${userId}\n`);

  try {
    const googleInfo = await getUserGoogleInfo(userId);

    if (!googleInfo) {
      console.log('❌ המשתמש לא מחובר ל-Google OAuth!\n');
      console.log('💡 פתרון:');
      console.log('   1. היכנס ל-Dashboard');
      console.log('   2. לחץ על "Connect Google Account"');
      console.log('   3. אשר את כל ההרשאות (Gmail, Calendar)');
      console.log('   4. חזור לדאשבורד\n');
      return;
    }

    console.log('✅ מחובר ל-Google OAuth!\n');
    console.log('📧 Email:', googleInfo.email);
    console.log('📅 התחבר ב:', googleInfo.connectedAt);
    console.log('🔐 הרשאות (Scopes):');
    
    const requiredScopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    googleInfo.scopes.forEach(scope => {
      const isRequired = requiredScopes.includes(scope);
      console.log(`   ${isRequired ? '✅' : '  '} ${scope}`);
    });

    console.log('\n🔍 בדיקת הרשאות חסרות:\n');
    const missingScopes = requiredScopes.filter(
      scope => !googleInfo.scopes.includes(scope)
    );

    if (missingScopes.length > 0) {
      console.log('❌ חסרות הרשאות:');
      missingScopes.forEach(scope => {
        console.log(`   • ${scope}`);
      });
      console.log('\n💡 פתרון: התחבר מחדש כדי לקבל את כל ההרשאות\n');
    } else {
      console.log('✅ כל ההרשאות קיימות!\n');
      console.log('═══════════════════════════════════════════════════');
      console.log('✅ Google OAuth מוגדר בצורה מושלמת!');
      console.log('   המערכת יכולה לשלוח מיילים ולקבוע פגישות.');
      console.log('');
    }

  } catch (error) {
    console.error('\n❌ שגיאה בבדיקת סטטוס OAuth:');
    console.error('  ', (error as Error).message);
    console.error('');
    console.error('🔧 פתרונות אפשריים:');
    console.error('   1. ודא שה-User ID נכון');
    console.error('   2. ודא שהמשתמש קיים ב-Supabase');
    console.error('   3. ודא שהמשתמש התחבר ב-Google OAuth');
    console.error('');
  }
}

// To get your user ID:
console.log('\n💡 כדי לקבל את ה-User ID שלך:');
console.log('   1. פתח Supabase Dashboard');
console.log('   2. עבור לטבלת "users"');
console.log('   3. העתק את ה-ID של המשתמש שלך');
console.log('   4. החלף את "YOUR_USER_ID_HERE" בקוד\n');

testGoogleOAuthStatus().catch(console.error);
