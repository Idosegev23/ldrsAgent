/**
 * Orchestration System Initialization
 * Initialize all orchestration components on startup
 */

import { toolDiscovery } from './tool-discovery.js';
import { agentRegistry } from './agent-registry.js';
import { webhookManager } from './webhooks/webhook-manager.js';
import { pluginManager } from './plugins/plugin-manager.js';
import { masterOrchestrator } from './master-orchestrator.js';
import { logger } from '../utils/logger.js';

let initialized = false;

/**
 * Initialize orchestration system
 */
export async function initializeOrchestration(): Promise<void> {
  if (initialized) {
    logger.info('Orchestration already initialized');
    return;
  }

  logger.info('Initializing orchestration system');

  try {
    // 1. Discover tools
    logger.info('Discovering tools...');
    const tools = await toolDiscovery.discover();
    logger.info('Tools discovered', { count: tools.length });

    // 2. Import agents to registry
    logger.info('Importing agents to registry...');
    agentRegistry.importFromTools(tools);
    const stats = agentRegistry.getStatistics();
    logger.info('Agent registry ready', stats);

    // 3. Load webhooks
    logger.info('Loading webhooks...');
    await webhookManager.loadWebhooks();

    // 4. Load plugins
    logger.info('Loading plugins...');
    await pluginManager.loadPlugins();

    // 5. Recover running executions
    logger.info('Recovering running executions...');
    await masterOrchestrator.recoverRunningExecutions();

    initialized = true;
    
    logger.info('Orchestration system initialized successfully', {
      tools: tools.length,
      agents: stats.totalAgents,
      webhooks: await webhookManager.getUserWebhooks('system').then(w => w.length),
      plugins: pluginManager.getStats().totalPlugins
    });
  } catch (error) {
    logger.error('Failed to initialize orchestration system', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Check if initialized
 */
export function isInitialized(): boolean {
  return initialized;
}

/**
 * Reset initialization (for testing)
 */
export function resetInitialization(): void {
  initialized = false;
  logger.info('Orchestration initialization reset');
}

/**
 * Get system status
 */
export async function getSystemStatus(): Promise<{
  initialized: boolean;
  activeExecutions: number;
  tools: number;
  agents: number;
  uptime: number;
}> {
  const toolsCount = toolDiscovery.getToolsCount();
  const agentStats = agentRegistry.getStatistics();
  const activeExecutions = masterOrchestrator.getActiveCount();

  return {
    initialized,
    activeExecutions,
    tools: toolsCount,
    agents: agentStats.totalAgents,
    uptime: process.uptime()
  };
}
