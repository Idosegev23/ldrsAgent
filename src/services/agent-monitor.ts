/**
 * Agent Monitoring Service
 * Track agent status, health, and performance
 */

import { getSupabaseAdmin } from '../db/client.js';
import { getAgentRegistry } from '../execution/agent-registry.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ component: 'AgentMonitor' });

export interface AgentStatus {
  id: string;
  name: string;
  nameHebrew: string;
  domain: string;
  layer: number;
  isEnabled: boolean;
  executionsToday: number;
  successToday: number;
  failuresToday: number;
  successRate: number | null;
  avgDuration: number | null;
  lastExecution: Date | null;
}

export interface IntegrationHealth {
  type: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  lastCheck: Date;
  lastSuccess: Date | null;
  errorCount: number;
  uptimePercentage: number;
}

/**
 * Initialize agents registry in database
 */
export async function syncAgentsRegistry(): Promise<void> {
  log.info('Syncing agents registry');

  const registry = getAgentRegistry();
  const agents = registry.getAll();
  const supabase = getSupabaseAdmin();

  for (const agent of agents) {
    await supabase
      .from('agents_registry')
      .upsert({
        id: agent.id,
        name: agent.name,
        name_hebrew: agent.nameHebrew || agent.name,
        domain: agent.domain,
        layer: agent.layer,
        description: agent.description,
        capabilities: agent.capabilities,
        requires_knowledge: agent.requiresKnowledge,
        is_enabled: true,
        config: {},
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
  }

  log.info('Agents registry synced', { count: agents.length });
}

/**
 * Get all agents with their status
 * Falls back to registry if DB is empty or view fails
 */
export async function getAllAgentsStatus(): Promise<AgentStatus[]> {
  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase
      .from('agent_dashboard_summary')
      .select('*')
      .order('layer', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      log.warn('Failed to get agents from view, using registry fallback', { error: error.message });
      return getAgentsFromRegistry();
    }

    if (!data || data.length === 0) {
      log.info('No agents in DB, using registry fallback');
      return getAgentsFromRegistry();
    }

    return data.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      nameHebrew: row.name_hebrew as string,
      domain: row.domain as string,
      layer: row.layer as number,
      isEnabled: row.is_enabled as boolean,
      executionsToday: row.executions_today as number || 0,
      successToday: row.success_today as number || 0,
      failuresToday: row.failures_today as number || 0,
      successRate: row.success_rate_today as number || null,
      avgDuration: row.avg_duration_ms_today as number || null,
      lastExecution: row.last_execution_at ? new Date(row.last_execution_at as string) : null,
    }));
  } catch (err) {
    log.error('Error getting agents status, using registry fallback', err as Error);
    return getAgentsFromRegistry();
  }
}

/**
 * Fallback: Get agents from code registry
 */
function getAgentsFromRegistry(): AgentStatus[] {
  const registry = getAgentRegistry();
  const agents = registry.getAll();

  return agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    nameHebrew: agent.nameHebrew || agent.name,
    domain: agent.domain,
    layer: agent.layer,
    isEnabled: true,
    executionsToday: 0,
    successToday: 0,
    failuresToday: 0,
    successRate: null,
    avgDuration: null,
    lastExecution: null,
  }));
}

/**
 * Get specific agent status
 */
export async function getAgentStatus(agentId: string): Promise<AgentStatus | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('agent_dashboard_summary')
    .select('*')
    .eq('id', agentId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id as string,
    name: data.name as string,
    nameHebrew: data.name_hebrew as string,
    domain: data.domain as string,
    layer: data.layer as number,
    isEnabled: data.is_enabled as boolean,
    executionsToday: data.executions_today as number || 0,
    successToday: data.success_today as number || 0,
    failuresToday: data.failures_today as number || 0,
    successRate: data.success_rate_today as number || null,
    avgDuration: data.avg_duration_ms_today as number || null,
    lastExecution: data.last_execution_at ? new Date(data.last_execution_at as string) : null,
  };
}

/**
 * Get agent statistics for a time range
 */
export async function getAgentStats(
  agentId: string,
  startTime?: Date,
  endTime?: Date
): Promise<{
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
} | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.rpc('get_agent_stats', {
    p_agent_id: agentId,
    p_start_time: startTime?.toISOString() || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    p_end_time: endTime?.toISOString() || new Date().toISOString(),
  });

  if (error || !data || data.length === 0) {
    return null;
  }

  const stats = data[0];
  return {
    totalExecutions: stats.total_executions || 0,
    successfulExecutions: stats.successful_executions || 0,
    failedExecutions: stats.failed_executions || 0,
    successRate: stats.success_rate || 0,
    avgDuration: stats.avg_duration_ms || 0,
    minDuration: stats.min_duration_ms || 0,
    maxDuration: stats.max_duration_ms || 0,
  };
}

/**
 * Get recent agent executions
 */
export async function getAgentExecutions(
  agentId: string,
  limit: number = 50
): Promise<Array<{
  id: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  duration: number | null;
  inputSummary: string | null;
  outputSummary: string | null;
  errorMessage: string | null;
}>> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('agent_executions')
    .select('id, status, started_at, completed_at, duration_ms, input_summary, output_summary, error_message')
    .eq('agent_id', agentId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    log.error('Failed to get agent executions', error, { agentId });
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    status: row.status,
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    duration: row.duration_ms,
    inputSummary: row.input_summary,
    outputSummary: row.output_summary,
    errorMessage: row.error_message,
  }));
}

/**
 * Check all integrations health
 * Reads directly from environment variables
 */
export async function checkIntegrationsHealth(): Promise<IntegrationHealth[]> {
  log.info('Checking integrations from environment variables');
  return getDefaultIntegrations();
}

/**
 * Default integrations when DB is unavailable
 * Check environment variables to determine actual status
 */
function getDefaultIntegrations(): IntegrationHealth[] {
  const now = new Date();
  
  log.info('Checking integrations from environment variables');
  
  // Check each integration based on required env vars
  const integrations: IntegrationHealth[] = [
    {
      type: 'google_drive',
      status: checkIntegrationStatus(['GOOGLE_SERVICE_ACCOUNT_KEY']),
      lastCheck: now,
      lastSuccess: null,
      errorCount: 0,
      uptimePercentage: 0,
    },
    {
      type: 'gmail',
      status: checkIntegrationStatus(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']),
      lastCheck: now,
      lastSuccess: null,
      errorCount: 0,
      uptimePercentage: 0,
    },
    {
      type: 'calendar',
      status: checkIntegrationStatus(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']),
      lastCheck: now,
      lastSuccess: null,
      errorCount: 0,
      uptimePercentage: 0,
    },
    {
      type: 'clickup',
      status: checkIntegrationStatus(['CLICKUP_API_TOKEN']),
      lastCheck: now,
      lastSuccess: null,
      errorCount: 0,
      uptimePercentage: 0,
    },
    {
      type: 'whatsapp',
      status: checkIntegrationStatus(['GREEN_API_TOKEN']),
      lastCheck: now,
      lastSuccess: null,
      errorCount: 0,
      uptimePercentage: 0,
    },
    {
      type: 'apify',
      status: checkIntegrationStatus(['APIFY_TOKEN']),
      lastCheck: now,
      lastSuccess: null,
      errorCount: 0,
      uptimePercentage: 0,
    },
  ];
  
  log.info('Integration check results', {
    healthy: integrations.filter(i => i.status === 'healthy').length,
    down: integrations.filter(i => i.status === 'down').length,
    unknown: integrations.filter(i => i.status === 'unknown').length,
  });
  
  return integrations;
}

/**
 * Check if integration is configured based on required env vars
 * Supports multiple naming conventions (GREEN_API vs GREENAPI)
 */
function checkIntegrationStatus(requiredEnvVars: string[]): 'healthy' | 'down' | 'unknown' {
  const results = requiredEnvVars.map((varName) => {
    // Check primary name
    let value = process.env[varName];
    
    // Check alternative names (GREEN_API <-> GREENAPI)
    if (!value) {
      const altName = varName.includes('GREEN_API') 
        ? varName.replace('GREEN_API', 'GREENAPI')
        : varName.replace('GREENAPI', 'GREEN_API');
      value = process.env[altName];
    }
    
    const hasValue = value && value.trim().length > 0;
    
    // Log for debugging
    log.debug('Checking env var', { 
      varName, 
      hasValue,
      valueLength: value?.length || 0
    });
    
    return hasValue;
  });
  
  const allConfigured = results.every((r) => r);
  const someConfigured = results.some((r) => r);
  
  if (allConfigured) {
    return 'healthy'; // Configured
  }
  
  if (someConfigured) {
    return 'down'; // Partially configured - missing some keys
  }
  
  return 'unknown'; // Not configured at all
}

/**
 * Update integration status
 */
export async function updateIntegrationStatus(
  integration: string,
  status: 'healthy' | 'degraded' | 'down',
  errorMessage?: string
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const updates: Record<string, unknown> = {
    status,
    last_check_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (status === 'healthy') {
    updates.last_success_at = new Date().toISOString();
    updates.error_count = 0;
    updates.last_error = null;
  } else {
    updates.last_error = errorMessage || null;
    // Increment error count
    const { data: current } = await supabase
      .from('integrations_status')
      .select('error_count')
      .eq('integration_type', integration)
      .single();

    updates.error_count = (current?.error_count || 0) + 1;
  }

  const { error } = await supabase
    .from('integrations_status')
    .update(updates)
    .eq('integration_type', integration);

  if (error) {
    log.error('Failed to update integration status', error, { integration });
  }
}

/**
 * Enable/disable an agent
 */
export async function setAgentEnabled(agentId: string, enabled: boolean): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('agents_registry')
    .update({
      is_enabled: enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agentId);

  if (error) {
    log.error('Failed to update agent status', error, { agentId, enabled });
    throw new Error('Failed to update agent status');
  }

  log.info('Agent status updated', { agentId, enabled });
}

/**
 * Get overall system stats
 */
export async function getSystemStats(): Promise<{
  totalAgents: number;
  activeAgents: number;
  executionsToday: number;
  successRate: number;
  healthyIntegrations: number;
  totalIntegrations: number;
}> {
  const [agents, integrations] = await Promise.all([
    getAllAgentsStatus(),
    checkIntegrationsHealth(),
  ]);

  const totalExecutions = agents.reduce((sum, a) => sum + a.executionsToday, 0);
  const totalSuccess = agents.reduce((sum, a) => sum + a.successToday, 0);

  return {
    totalAgents: agents.length,
    activeAgents: agents.filter((a) => a.isEnabled).length,
    executionsToday: totalExecutions,
    successRate: totalExecutions > 0 ? Math.round((totalSuccess / totalExecutions) * 100) : 0,
    healthyIntegrations: integrations.filter((i) => i.status === 'healthy').length,
    totalIntegrations: integrations.length,
  };
}
