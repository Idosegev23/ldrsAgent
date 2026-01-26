/**
 * Test Command
 * Run system tests
 */

import { classifyIntent } from '../../control/intent-classifier.js';
import { retrieveKnowledge } from '../../knowledge/retriever.js';
import { initializeAgents, getAgentRegistry } from '../../execution/agent-registry.js';
import { logger } from '../../utils/logger.js';

interface TestOptions {
  intent?: boolean;
  knowledge?: boolean;
  agent?: string;
}

export async function testCommand(options: TestOptions): Promise<void> {
  const log = logger.child({ component: 'CLI:test' });

  console.log('\n--- System Tests ---\n');

  try {
    let passed = 0;
    let failed = 0;

    // Test intent classification
    if (options.intent || (!options.knowledge && !options.agent)) {
      console.log('## Intent Classification\n');

      const testCases = [
        {
          input: 'תבנה לי אסטרטגיית מדיה ללקוח סיקרט',
          expected: 'media_strategy',
        },
        {
          input: 'מה הסטטוס של הדיל עם חברת ABC?',
          expected: 'sales_tracking',
        },
        {
          input: 'תכתוב מייל follow up ללקוח',
          expected: 'sales_email',
        },
        {
          input: 'מה יש לי ביומן מחר?',
          expected: 'calendar_query',
        },
      ];

      for (const test of testCases) {
        const result = await classifyIntent(test.input);
        const success = result.primary === test.expected;

        if (success) {
          passed++;
          console.log(`  [PASS] "${test.input.slice(0, 30)}..."`);
          console.log(`         Expected: ${test.expected}, Got: ${result.primary}`);
        } else {
          failed++;
          console.log(`  [FAIL] "${test.input.slice(0, 30)}..."`);
          console.log(`         Expected: ${test.expected}, Got: ${result.primary}`);
        }
      }

      console.log();
    }

    // Test knowledge retrieval
    if (options.knowledge) {
      console.log('## Knowledge Retrieval\n');

      const result = await retrieveKnowledge('test query', 'test-job-id', {});
      
      console.log(`  Status: ${result.status}`);
      console.log(`  Ready: ${result.ready}`);
      console.log(`  Documents: ${result.documents.length}`);
      console.log(`  Chunks: ${result.chunks.length}`);

      if (result.ready) {
        passed++;
        console.log('  [PASS] Knowledge retrieval working');
      } else {
        failed++;
        console.log('  [FAIL] Knowledge retrieval not ready');
      }

      console.log();
    }

    // Test specific agent
    if (options.agent) {
      console.log(`## Agent: ${options.agent}\n`);

      await initializeAgents();
      const registry = getAgentRegistry();
      const agent = registry.get(options.agent);

      if (agent) {
        console.log(`  Name: ${agent.name}`);
        console.log(`  Hebrew: ${agent.nameHebrew}`);
        console.log(`  Layer: ${agent.layer}`);
        console.log(`  Domain: ${agent.domain}`);
        console.log(`  Capabilities: ${agent.capabilities.join(', ')}`);
        passed++;
        console.log('  [PASS] Agent found');
      } else {
        failed++;
        console.log(`  [FAIL] Agent not found: ${options.agent}`);
      }

      console.log();
    }

    // Summary
    console.log('---');
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
      process.exit(1);
    }

  } catch (error) {
    log.error('Test command failed', error as Error);
    console.error('\nError:', (error as Error).message);
    process.exit(1);
  }
}

