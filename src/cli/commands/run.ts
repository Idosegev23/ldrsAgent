/**
 * Run Command
 * Process a request through the agent system
 */

import { processSingleRequest } from '../../control/orchestrator.js';
import { initializeAgents } from '../../execution/agent-registry.js';
import { getOrCreateUser } from '../../db/repositories/users.repo.js';
import { logger } from '../../utils/logger.js';

interface RunOptions {
  user?: string;
  client?: string;
  debug?: boolean;
}

export async function runCommand(
  request: string,
  options: RunOptions
): Promise<void> {
  const log = logger.child({ component: 'CLI:run' });

  console.log('\n--- LeadrsAgents ---\n');
  console.log(`Processing: "${request}"\n`);

  try {
    // Initialize agents
    await initializeAgents();

    // Get or create user
    const email = options.user || 'cli@leadrs.local';
    const user = await getOrCreateUser(email, 'CLI User');

    console.log(`User: ${user.email}\n`);

    // Process request
    const startTime = Date.now();
    const response = await processSingleRequest(
      request,
      user.id,
      options.client
    );
    const elapsed = Date.now() - startTime;

    console.log('---\n');
    console.log(response);
    console.log('\n---');

    if (options.debug) {
      console.log(`\nProcessed in ${elapsed}ms`);
    }

  } catch (error) {
    log.error('Run command failed', error as Error);
    console.error('\nError:', (error as Error).message);
    process.exit(1);
  }
}

