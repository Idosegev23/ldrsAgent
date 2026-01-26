/**
 * List All Registered Agents
 * Shows details about all agents in the system
 */

import { initializeAgents, getAgentRegistry } from '../src/execution/agent-registry.js';
import { logger } from '../src/utils/logger.js';

async function main() {
  console.log('\n🤖 רשימת סוכנים במערכת\n');
  console.log('='.repeat(80));

  // Initialize agents
  await initializeAgents();
  const registry = getAgentRegistry();

  const allAgents = registry.getAll();

  // Group by domain
  const byDomain = new Map<string, typeof allAgents>();
  allAgents.forEach((agent) => {
    if (!byDomain.has(agent.domain)) {
      byDomain.set(agent.domain, []);
    }
    byDomain.get(agent.domain)!.push(agent);
  });

  // Domain names in Hebrew
  const domainNames: Record<string, string> = {
    proposals: 'הצעות מחיר',
    research: 'מחקר',
    influencers: 'משפיענים',
    media: 'מדיה',
    creative: 'קריאייטיב',
    operations: 'תפעול',
    sales: 'מכירות',
    hr: 'משאבי אנוש',
    finance: 'כספים',
    executive: 'הנהלה',
    general: 'כללי',
  };

  // Sort domains
  const sortedDomains = Array.from(byDomain.keys()).sort();

  sortedDomains.forEach((domain) => {
    const agents = byDomain.get(domain)!;
    console.log(`\n📁 ${domainNames[domain] || domain} (${agents.length} סוכנים)`);
    console.log('-'.repeat(80));

    agents.forEach((agent) => {
      console.log(`\n  ✓ ${agent.nameHebrew || agent.name}`);
      console.log(`    ID: ${agent.id}`);
      console.log(`    Layer: ${agent.layer}`);
      if (agent.description) {
        console.log(`    תיאור: ${agent.description}`);
      }
      if (agent.capabilities && agent.capabilities.length > 0) {
        console.log(`    יכולות: ${agent.capabilities.join(', ')}`);
      }
      console.log(`    צריך ידע: ${agent.requiresKnowledge ? 'כן' : 'לא'}`);
    });
  });

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 סה״כ: ${allAgents.length} סוכנים במערכת\n`);

  // Stats by layer
  console.log('📈 חלוקה לפי שכבה:');
  console.log(`   Layer 0 (תשתית): ${registry.getByLayer(0).length} סוכנים`);
  console.log(`   Layer 1 (כניסה): ${registry.getByLayer(1).length} סוכנים`);
  console.log(`   Layer 2 (מומחים): ${registry.getByLayer(2).length} סוכנים`);
  console.log('');
}

main().catch((error) => {
  console.error('❌ שגיאה:', error);
  process.exit(1);
});
