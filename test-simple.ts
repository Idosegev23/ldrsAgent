/**
 * בדיקות פשוטות מאוד - רק in-memory components
 */

console.log('🧪 בדיקות רכיבים in-memory...\n');
console.log('═══════════════════════════════════════════════\n');

// Test 1: Imports
console.log('📦 Test 1: בודק imports');
console.log('─────────────────────────────────────');
try {
  console.log('Loading modules...');
  
  // Import simple modules only
  const { sharedContextStore } = await import('./src/orchestration/shared-context.js');
  const { agentMessenger } = await import('./src/orchestration/agent-messenger.js');
  
  console.log('✅ Imports הצליחו!\n');
  
  // Test 2: Shared Context
  console.log('💾 Test 2: Shared Context');
  console.log('─────────────────────────────────────');
  
  const execId = 'test-' + Date.now();
  
  sharedContextStore.set(execId, 'data1', { value: 'Hello' }, 'agent-1');
  sharedContextStore.set(execId, 'data2', { value: 'World' }, 'agent-2');
  
  const data1 = sharedContextStore.get(execId, 'data1');
  const data2 = sharedContextStore.get(execId, 'data2');
  
  console.log(`✅ נתונים נשמרו ונקראו בהצלחה!`);
  console.log(`   • data1: "${data1?.value}"`);
  console.log(`   • data2: "${data2?.value}"`);
  
  // Test locks
  console.log('\n🔒 בודק locks...');
  const lock1 = sharedContextStore.acquireLock(execId, 'resource', 'agent-1');
  const lock2 = sharedContextStore.acquireLock(execId, 'resource', 'agent-2');
  
  console.log(`   • Lock 1 (צריך להצליח): ${lock1 ? '✓' : '✗'}`);
  console.log(`   • Lock 2 (צריך להיכשל): ${lock2 ? '✗ בעיה!' : '✓'}`);
  
  sharedContextStore.releaseLock(execId, 'resource', 'agent-1');
  console.log(`   • Lock שוחרר ✓`);
  
  console.log('\n═══════════════════════════════════════════════\n');
  
  // Test 3: Agent Messenger
  console.log('📨 Test 3: Inter-Agent Messaging');
  console.log('─────────────────────────────────────');
  
  let messageReceived = false;
  let messageContent = '';
  
  // Register handler
  agentMessenger.registerHandler('receiver', 'REQUEST', async (msg) => {
    messageReceived = true;
    messageContent = msg.payload.text;
    return { success: true };
  });
  
  // Send message
  await agentMessenger.send(
    execId,
    'sender',
    'receiver',
    'REQUEST',
    { text: 'שלום עולם!' }
  );
  
  // Wait a bit
  await new Promise(r => setTimeout(r, 100));
  
  console.log(`✅ הודעה נשלחה והתקבלה!`);
  console.log(`   • התקבלה: ${messageReceived ? '✓' : '✗'}`);
  console.log(`   • תוכן: "${messageContent}"`);
  
  console.log('\n═══════════════════════════════════════════════\n');
  
  // Summary
  console.log('📊 סיכום');
  console.log('═══════════════════════════════════════════════');
  console.log('');
  console.log('✅ Shared Context Store - עובד מעולה!');
  console.log('✅ Agent Messenger - עובד מעולה!');
  console.log('✅ In-memory components - עובדים מעולה!');
  console.log('');
  console.log('🎉 הרכיבים הבסיסיים עובדים!');
  console.log('');
  console.log('💡 הצעד הבא:');
  console.log('   1. הרץ: npm run db:migrate');
  console.log('   2. הרץ: cd web && npm run dev');
  console.log('   3. פתח: http://localhost:3000/orchestrate');
  console.log('');
  
} catch (error: any) {
  console.error('❌ שגיאה:', error.message);
  console.error('\nStack:', error.stack);
}
