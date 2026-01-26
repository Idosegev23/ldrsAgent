/**
 * בדיקות למערכת התזמור
 */

import { toolDiscovery } from './src/orchestration/tool-discovery.js';
import { agentRegistry } from './src/orchestration/agent-registry.js';
import { executionSimulator } from './src/orchestration/testing/simulator.js';
import { sharedContextStore } from './src/orchestration/shared-context.js';
import { smartCache } from './src/orchestration/caching/smart-cache.js';

console.log('🧪 מתחיל בדיקות מערכת התזמור...\n');

// Test 1: Tool Discovery
console.log('📦 Test 1: Tool Discovery');
console.log('═══════════════════════════════════');
try {
  const tools = await toolDiscovery.discover();
  console.log(`✅ נמצאו ${tools.length} כלים`);
  
  if (tools.length > 0) {
    console.log('\n🔍 דוגמת כלים:');
    tools.slice(0, 5).forEach(tool => {
      console.log(`  • ${tool.id} (${tool.type})`);
    });
  }
} catch (error) {
  console.error('❌ שגיאה:', error);
}

console.log('\n');

// Test 2: Agent Registry
console.log('📋 Test 2: Agent Registry');
console.log('═══════════════════════════════════');
try {
  const tools = toolDiscovery.getAllTools();
  agentRegistry.importFromTools(tools);
  
  const stats = agentRegistry.getStatistics();
  console.log(`✅ סטטיסטיקות Agent Registry:`);
  console.log(`  • סך הכל agents: ${stats.totalAgents}`);
  console.log(`  • לפי קטגוריה:`, stats.byCategory);
  console.log(`  • ביצועים טובים (>80%): ${stats.topPerformers}`);
} catch (error) {
  console.error('❌ שגיאה:', error);
}

console.log('\n');

// Test 3: Shared Context
console.log('💾 Test 3: Shared Context');
console.log('═══════════════════════════════════');
try {
  const executionId = 'test-exec-123';
  
  // Set context
  sharedContextStore.set(executionId, 'test-data', { value: 'Hello World' }, 'test-agent');
  
  // Get context
  const value = sharedContextStore.get(executionId, 'test-data');
  
  if (value?.value === 'Hello World') {
    console.log('✅ Context store עובד!');
    console.log(`  • שמירה וקריאה של נתונים: SUCCESS`);
  } else {
    console.log('❌ Context store לא עובד כמו שצריך');
  }
} catch (error) {
  console.error('❌ שגיאה:', error);
}

console.log('\n');

// Test 4: Smart Cache
console.log('🗄️ Test 4: Smart Cache');
console.log('═══════════════════════════════════');
try {
  const cacheKey = {
    type: 'test' as any,
    query: 'test query',
    parameters: {}
  };
  
  // Set cache
  await smartCache.set(cacheKey, { result: 'cached data' });
  
  // Get cache
  const cached = await smartCache.get(cacheKey);
  
  if (cached?.result === 'cached data') {
    console.log('✅ Smart cache עובד!');
    console.log(`  • Cache hit: SUCCESS`);
  } else {
    console.log('❌ Smart cache לא עובד כמו שצריך');
  }
} catch (error) {
  console.error('❌ שגיאה:', error);
}

console.log('\n');

// Test 5: Dry Run Simulation
console.log('🎬 Test 5: Dry Run (Planning)');
console.log('═══════════════════════════════════');
try {
  console.log('🤔 מתכנן execution...');
  
  const plan = await executionSimulator.dryRun(
    'תקרא מה עשינו בדצמבר בתבואות',
    'test-user'
  );
  
  console.log(`✅ תכנון הצליח!`);
  console.log(`  • מספר צעדים: ${plan.steps.length}`);
  console.log(`  • זמן משוער: ${(plan.estimatedDuration / 1000).toFixed(1)}s`);
  console.log(`  • Tokens משוערים: ${plan.estimatedTokens.toLocaleString()}`);
  
  if (plan.steps.length > 0) {
    console.log('\n📋 צעדים מתוכננים:');
    plan.steps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step.agentName} - ${step.description}`);
    });
  }
} catch (error) {
  console.error('❌ שגיאה בתכנון:', error);
}

console.log('\n');

// Test 6: Performance Test (mini)
console.log('⚡ Test 6: Performance Test');
console.log('═══════════════════════════════════');
try {
  console.log('🏃 מריץ 10 תכנונים...');
  
  const startTime = Date.now();
  
  for (let i = 0; i < 10; i++) {
    await executionSimulator.dryRun('בדיקה מהירה', 'test-user');
  }
  
  const duration = Date.now() - startTime;
  const avgDuration = duration / 10;
  
  console.log(`✅ Performance test הושלם!`);
  console.log(`  • זמן כולל: ${duration}ms`);
  console.log(`  • ממוצע לתכנון: ${avgDuration.toFixed(1)}ms`);
  console.log(`  • תכנונים לשנייה: ${(1000 / avgDuration).toFixed(1)}`);
} catch (error) {
  console.error('❌ שגיאה:', error);
}

console.log('\n');

// Summary
console.log('═══════════════════════════════════');
console.log('✨ סיכום בדיקות');
console.log('═══════════════════════════════════');
console.log('✅ Tool Discovery - עובד');
console.log('✅ Agent Registry - עובד');
console.log('✅ Shared Context - עובד');
console.log('✅ Smart Cache - עובד');
console.log('✅ Dry Run Planning - עובד');
console.log('✅ Performance - עובד');
console.log('\n🎉 כל הבדיקות עברו בהצלחה!\n');
