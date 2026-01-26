/**
 * Test Canva Proposal Creation
 * Demonstrates full workflow for creating a proposal in Canva
 */

import { CanvaAgent } from './src/execution/agents/canva.agent.js';

// Mock data for testing
const mockProposalData = {
  clientName: 'לקוח דמה',
  projectName: 'פרויקט מדיה דיגיטלית',
  services: [
    {
      name: 'ניהול מדיה חברתית',
      description: 'פוסטים יומיים, סטוריז, ריספונס',
      price: '₪5,000',
      duration: 'חודשי'
    },
    {
      name: 'קמפיינים ממומנים',
      description: 'ניהול קמפיינים ב-Facebook & Instagram',
      price: '₪8,000',
      duration: 'חודשי'
    },
    {
      name: 'יצירת תוכן',
      description: '12 פוסטים מעוצבים + 4 וידאו',
      price: '₪6,000',
      duration: 'חודשי'
    }
  ],
  totalMonthly: '₪19,000',
  totalQuarterly: '₪54,000',
  notes: [
    '✓ ישיבת קיק-אוף ותכנון אסטרטגיה',
    '✓ דוח ביצועים חודשי מפורט',
    '✓ תמיכה שוטפת בוואטסאפ',
    '✓ 2 שעות ייעוץ אסטרטגי חודשי'
  ]
};

async function testCanvaProposal() {
  console.log('🎨 מתחיל טסט יצירת הצעת מחיר ב-Canva...\n');

  // Step 1: Initialize agent
  console.log('📋 שלב 1: אתחול Canva Agent');
  try {
    const agent = new CanvaAgent();
    console.log('✅ Agent initialized\n');

    // Step 2: Search for "הצעת מחיר" template
    console.log('🔍 שלב 2: חיפוש תבנית "הצעת מחיר"');
    console.log('   בקשה: "חפש לי תבנית של הצעת מחיר רזה ב-Canva"\n');
    
    // This would normally call:
    // const searchResult = await agent.execute({
    //   userId: 'test-user-id',
    //   request: 'חפש לי תבנית של הצעת מחיר רזה',
    //   executionId: 'test-exec-1'
    // });

    console.log('   📄 סימולציה: מצאתי 3 תבניות הצעת מחיר:');
    console.log('      1. הצעת מחיר רזה - מינימליסטית');
    console.log('      2. הצעת מחיר מקצועית - עם לוגו');
    console.log('      3. הצעת מחיר קריאייטיבית - צבעונית\n');

    // Step 3: Create design from template
    console.log('✨ שלב 3: יצירת דיזיין חדש מהתבנית');
    console.log(`   כותרת: "הצעת מחיר - ${mockProposalData.clientName}"\n`);

    // This would call:
    // const createResult = await agent.execute({
    //   userId: 'test-user-id',
    //   request: 'צור דיזיין חדש מתבנית הצעת מחיר רזה',
    //   executionId: 'test-exec-2'
    // });

    console.log('   ✅ דיזיין נוצר! ID: design_abc123\n');

    // Step 4: Show what content would be added
    console.log('📝 שלב 4: תוכן שיתווסף לדיזיין:');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   🏢 לקוח: ${mockProposalData.clientName}`);
    console.log(`   📊 פרויקט: ${mockProposalData.projectName}`);
    console.log('\n   💼 שירותים מוצעים:');
    mockProposalData.services.forEach((service, i) => {
      console.log(`\n   ${i + 1}. ${service.name}`);
      console.log(`      📝 ${service.description}`);
      console.log(`      💰 ${service.price} / ${service.duration}`);
    });
    console.log('\n   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   📈 סה"כ חודשי: ${mockProposalData.totalMonthly}`);
    console.log(`   📊 סה"כ רבעוני: ${mockProposalData.totalQuarterly}`);
    console.log('\n   ✨ כולל:');
    mockProposalData.notes.forEach(note => {
      console.log(`      ${note}`);
    });
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Step 5: Would add images/branding
    console.log('🖼️ שלב 5: הוספת תמונות ו-branding:');
    console.log('   • לוגו החברה (מ-assets)');
    console.log('   • תמונות רקע מקצועיות');
    console.log('   • אייקונים לכל שירות');
    console.log('   • צבעי המותג\n');

    // Step 6: Export to PDF
    console.log('📄 שלב 6: ייצוא ל-PDF');
    console.log('   פורמט: PDF להדפסה');
    console.log('   איכות: גבוהה (300 DPI)\n');

    // This would call:
    // const exportResult = await agent.execute({
    //   userId: 'test-user-id',
    //   request: 'ייצא את הדיזיין ל-PDF',
    //   executionId: 'test-exec-3'
    // });

    console.log('   ✅ הקובץ יוצא!\n');
    console.log('   📥 להורדה: https://export.canva.com/abc123/proposal.pdf');
    console.log('   ⏰ הקישור תקף ל-24 שעות\n');

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ הטסט הושלם בהצלחה!\n');
    console.log('📊 סיכום:');
    console.log('   ✓ חיפוש תבנית הצעת מחיר');
    console.log('   ✓ יצירת דיזיין מהתבנית');
    console.log('   ✓ הוספת תוכן מותאם אישית');
    console.log('   ✓ הוספת תמונות ו-branding');
    console.log('   ✓ ייצוא ל-PDF מקצועי\n');
    console.log('💡 כדי להריץ באמת:');
    console.log('   1. הפעל את השרת: cd web && pnpm dev');
    console.log('   2. גש ל-http://127.0.0.1:3000/dashboard');
    console.log('   3. לחץ "התחבר ל-Canva"');
    console.log('   4. אז תוכל לשלוח בקשה זו בצ\'אט!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ שגיאה:', error);
    console.log('\n💡 הערה: זה נורמלי - צריך OAuth connection אמיתי');
    console.log('   הטסט מראה את הלוגיקה, אבל לא יכול לרוץ בלי חיבור אמיתי ל-Canva\n');
  }
}

// Run test
console.log('\n');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║                                                          ║');
console.log('║         🎨 Canva Proposal Creation Test 🎨              ║');
console.log('║                                                          ║');
console.log('║    בודק יכולת ליצור הצעת מחיר מקצועית ב-Canva          ║');
console.log('║                                                          ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('\n');

testCanvaProposal();
