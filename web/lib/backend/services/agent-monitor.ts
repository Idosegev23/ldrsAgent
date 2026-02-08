/**
 * Agent Monitoring Service
 * Serverless-compatible agent status tracking
 */

import { createClient } from '@supabase/supabase-js';
import { getAgentRegistry } from '../execution/agent-registry';

const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }
  
  return createClient(supabaseUrl, supabaseKey);
};

export async function getSystemStats() {
  const supabase = getSupabase();
  
  // Get job statistics
  const { count: totalJobs } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true });
  
  const { count: activeJobs } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'running']);
  
  const { count: completedJobs } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed');
  
  const agents = getAgentRegistry().getAllAgents();
  
  return {
    totalJobs: totalJobs || 0,
    activeJobs: activeJobs || 0,
    completedJobs: completedJobs || 0,
    totalAgents: agents.length,
  };
}

export async function getAllAgentsStatus() {
  const agents = getAgentRegistry().getAllAgents();
  const supabase = getSupabase();
  
  // Get execution count for each agent (if we have this data)
  const agentsWithStats = await Promise.all(
    agents.map(async (agent) => {
      const { count } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('agentId', agent.id);
      
      return {
        ...agent,
        executionsToday: count || 0,
      };
    })
  );
  
  return agentsWithStats;
}

export async function getAgentDetails(agentId: string) {
  const agent = getAgentRegistry().getAgent(agentId);
  
  if (!agent) {
    return null;
  }
  
  const supabase = getSupabase();
  
  const { count: totalExecutions } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('agentId', agentId);
  
  const { count: successfulExecutions } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('agentId', agentId)
    .eq('status', 'completed');
  
  return {
    ...agent,
    totalExecutions: totalExecutions || 0,
    successfulExecutions: successfulExecutions || 0,
    successRate: totalExecutions ? ((successfulExecutions || 0) / totalExecutions) * 100 : 0,
  };
}

export async function checkIntegrationsHealth() {
  // Check if integrations are configured
  const integrations = {
    supabase: {
      status: !!process.env.SUPABASE_URL ? 'connected' : 'not_configured',
      name: 'Supabase Database',
    },
    openai: {
      status: !!process.env.OPENAI_API_KEY ? 'connected' : 'not_configured',
      name: 'OpenAI API',
    },
    gemini: {
      status: !!process.env.GEMINI_API_KEY ? 'connected' : 'not_configured',
      name: 'Google Gemini',
    },
    google: {
      status: !!process.env.GOOGLE_CLIENT_ID ? 'connected' : 'not_configured',
      name: 'Google OAuth',
    },
    canva: {
      status: !!process.env.CANVA_CLIENT_ID ? 'connected' : 'not_configured',
      name: 'Canva API',
    },
  };
  
  return integrations;
}

export async function syncAgentsRegistry() {
  // In serverless, registry is static - no sync needed
  const agents = getAgentRegistry().getAllAgents();
  
  return {
    success: true,
    agentCount: agents.length,
    message: 'Agent registry is static in serverless mode',
  };
}

export async function getAgentStats(agentId: string) {
  return getAgentDetails(agentId);
}

export async function getAgentExecutions(agentId: string, limit = 50) {
  const supabase = getSupabase();
  
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('agentId', agentId)
    .order('createdAt', { ascending: false })
    .limit(limit);
  
  return jobs || [];
}

export async function getAgentStatus(agentId: string) {
  const agent = getAgentRegistry().getAgent(agentId);
  
  if (!agent) {
    return null;
  }
  
  return {
    ...agent,
    status: 'active',
    lastExecutionAt: null,
  };
}
