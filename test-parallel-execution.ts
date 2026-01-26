/**
 * Test Parallel Execution
 * Demonstrates how multiple agents run in parallel
 */

import { ParallelExecutor } from './src/orchestration/parallel-executor.js';
import type { ExecutionPlan, ExecutionStep } from './src/types/orchestration.types.js';
import type { ExecutionContext } from './src/types/execution.types.js';
import { v4 as uuidv4 } from 'uuid';

async function testParallelExecution() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                                                          ║');
  console.log('║      🚀 Parallel Execution Test 🚀                      ║');
  console.log('║                                                          ║');
  console.log('║  מדגים הרצה מקבילית של מספר agents                      ║');
  console.log('║                                                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const executor = new ParallelExecutor();
  const executionId = uuidv4();

  // Create test steps with different dependency patterns
  const steps: ExecutionStep[] = [
    // Batch 1: No dependencies - can run in parallel
    {
      id: 'step-1',
      stepNumber: 1,
      agentId: 'drive-search',
      agentName: 'Drive Search Agent',
      description: 'חיפוש קבצים ב-Drive',
      input: {
        task: 'חפש קבצים של דצמבר',
        context: {},
        requirements: []
      },
      status: 'PENDING',
      dependencies: [] // No deps
    },
    {
      id: 'step-2',
      stepNumber: 2,
      agentId: 'contacts',
      agentName: 'Contact Search Agent',
      description: 'חיפוש אנשי קשר',
      input: {
        task: 'מצא אנשי קשר רלוונטיים',
        context: {},
        requirements: []
      },
      status: 'PENDING',
      dependencies: [] // No deps - parallel with step-1
    },
    {
      id: 'step-3',
      stepNumber: 3,
      agentId: 'calendar',
      agentName: 'Calendar Agent',
      description: 'בדיקת לוח שנה',
      input: {
        task: 'בדוק זמינות ללוח שנה',
        context: {},
        requirements: []
      },
      status: 'PENDING',
      dependencies: [] // No deps - parallel with step-1 & step-2
    },

    // Batch 2: Depends on step-1 and step-2
    {
      id: 'step-4',
      stepNumber: 4,
      agentId: 'editor',
      agentName: 'Content Editor Agent',
      description: 'עריכת תוכן',
      input: {
        task: 'ערוך את התוכן מהדרייב והאנשי קשר',
        context: {},
        requirements: []
      },
      status: 'PENDING',
      dependencies: ['step-1', 'step-2'] // Depends on both
    },
    {
      id: 'step-5',
      stepNumber: 5,
      agentId: 'assistant',
      agentName: 'General Assistant',
      description: 'סיכום נתונים',
      input: {
        task: 'סכם את הממצאים',
        context: {},
        requirements: []
      },
      status: 'PENDING',
      dependencies: ['step-1'] // Only depends on step-1
    },

    // Batch 3: Depends on step-4
    {
      id: 'step-6',
      stepNumber: 6,
      agentId: 'creative',
      agentName: 'Creative Ideas Agent',
      description: 'רעיונות קריאייטיב',
      input: {
        task: 'צור רעיונות מהתוכן הערוך',
        context: {},
        requirements: []
      },
      status: 'PENDING',
      dependencies: ['step-4'] // Must wait for step-4
    }
  ];

  const plan: ExecutionPlan = {
    id: uuidv4(),
    executionId,
    steps,
    dependencies: {
      nodes: steps.map(s => s.id),
      edges: []
    },
    createdAt: new Date()
  };

  const context: ExecutionContext = {
    executionId,
    userId: 'test-user',
    workspaceId: 'test-workspace',
    userEmail: 'test@example.com',
    timestamp: new Date()
  };

  console.log('📋 תכנית ביצוע:\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('📦 Batch 1: (ללא תלויות - יורצו במקביל)');
  console.log('   1. Drive Search - חיפוש קבצים');
  console.log('   2. Contact Search - חיפוש אנשי קשר');
  console.log('   3. Calendar - בדיקת זמינות\n');
  
  console.log('📦 Batch 2: (תלוי ב-Batch 1)');
  console.log('   4. Content Editor - תלוי ב-1,2 (ממתין ל-2)');
  console.log('   5. General Assistant - תלוי ב-1 (יכול לרוץ במקביל ל-4)\n');
  
  console.log('📦 Batch 3: (תלוי ב-Batch 2)');
  console.log('   6. Creative Ideas - תלוי ב-4\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('🚀 מתחיל ביצוע מקבילי...\n');
  const startTime = Date.now();

  try {
    const result = await executor.execute(plan, context, {});

    const totalTime = Date.now() - startTime;

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ביצוע הושלם בהצלחה!\n');
    
    console.log('📊 סטטיסטיקה:');
    console.log(`   ⏱️  זמן כולל: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`);
    console.log(`   ✓ Steps שהצליחו: ${result.steps.filter(s => s.status === 'COMPLETED').length}/${result.steps.length}`);
    console.log(`   ❌ Steps שנכשלו: ${result.steps.filter(s => s.status === 'FAILED').length}`);
    console.log(`   🎯 Tokens ששומשו: ${result.totalTokensUsed}`);
    console.log(`   📈 Success Rate: ${result.success ? '100%' : 'Partial'}\n`);

    console.log('📝 תוצאות לפי steps:\n');
    for (const step of result.steps) {
      const icon = step.status === 'COMPLETED' ? '✅' : 
                   step.status === 'FAILED' ? '❌' : '⏳';
      const time = step.durationMs ? `${step.durationMs}ms` : 'N/A';
      console.log(`   ${icon} Step ${step.stepNumber}: ${step.agentName} (${time})`);
    }

    console.log('\n💡 השוואה לביצוע סדרתי:\n');
    const totalStepTime = result.steps.reduce((sum, s) => sum + (s.durationMs || 0), 0);
    const parallelTime = totalTime;
    const speedup = (totalStepTime / parallelTime).toFixed(1);
    const savings = ((totalStepTime - parallelTime) / 1000).toFixed(1);

    console.log(`   🐌 סדרתי (Sequential): ~${(totalStepTime / 1000).toFixed(1)}s`);
    console.log(`   ⚡ מקבילי (Parallel): ${(parallelTime / 1000).toFixed(1)}s`);
    console.log(`   📈 Speedup: ${speedup}x מהיר יותר`);
    console.log(`   💰 חסכון בזמן: ${savings}s\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🎯 מה קרה מאחורי הקלעים:\n');
    console.log('   1️⃣ Batch 1: Steps 1,2,3 רצו במקביל עם Promise.all()');
    console.log('   2️⃣ הבאצ׳ חיכה עד שהכל נגמר');
    console.log('   3️⃣ Batch 2: Steps 4,5 רצו במקביל (אין תלות ביניהם)');
    console.log('   4️⃣ Batch 3: Step 6 רץ אחרון (תלוי ב-4)\n');

    console.log('✨ יתרונות:\n');
    console.log('   ✓ חסכון משמעותי בזמן');
    console.log('   ✓ ניצול מקסימלי של משאבים');
    console.log('   ✓ שמירה על dependency order');
    console.log('   ✓ תמיכה ב-error handling מתקדם\n');

    console.log('🔧 איך להשתמש:\n');
    console.log('   • פשוט תבקש ביצוע רגיל - המערכת תטפל באופן אוטומטי!');
    console.log('   • Steps ללא תלויות ירוצו במקביל');
    console.log('   • Steps עם תלויות ימתינו אוטומטית\n');

  } catch (error) {
    console.error('❌ שגיאה:', error);
  }
}

// Run test
testParallelExecution().catch(console.error);
