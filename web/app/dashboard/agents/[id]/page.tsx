'use client';

/**
 * Agent Details Page
 * Detailed view of specific agent performance
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '../../../../components/DashboardLayout';
import { apiGet } from '@/lib/api';

interface AgentDetails {
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
  lastExecution: string | null;
}

interface AgentStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
}

interface AgentExecution {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  inputSummary: string | null;
  outputSummary: string | null;
  errorMessage: string | null;
}

// Domain colors
const domainColors: Record<string, string> = {
  proposals: 'from-blue-500 to-cyan-500',
  research: 'from-purple-500 to-pink-500',
  influencers: 'from-orange-500 to-yellow-500',
  media: 'from-green-500 to-emerald-500',
  creative: 'from-pink-500 to-rose-500',
  operations: 'from-indigo-500 to-violet-500',
  sales: 'from-red-500 to-orange-500',
  hr: 'from-teal-500 to-cyan-500',
  finance: 'from-emerald-500 to-green-500',
  executive: 'from-amber-500 to-yellow-500',
  general: 'from-gray-500 to-slate-500',
};

export default function AgentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<AgentDetails | null>(null);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [executions, setExecutions] = useState<AgentExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (agentId) {
      fetchAgentData();
    }
  }, [agentId]);

  const fetchAgentData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch agent data with auth
      const agentData = await apiGet<{ success: boolean; agent: AgentDetails }>(`/api/dashboard/agents/${agentId}`);
      
      if (!agentData.success || !agentData.agent) {
        setError('סוכן לא נמצא');
        return;
      }
      
      setAgent(agentData.agent);
      
      // Try to fetch stats and executions (may not have data yet)
      try {
        const statsData = await apiGet<{ stats: AgentStats | null }>(`/api/dashboard/agents/${agentId}/stats`);
        setStats(statsData.stats || null);
      } catch {
        setStats(null);
      }
      
      try {
        const executionsData = await apiGet<{ executions: AgentExecution[] }>(`/api/dashboard/agents/${agentId}/executions?limit=50`);
        setExecutions(executionsData.executions || []);
      } catch {
        setExecutions([]);
      }
      
      setError(null);
    } catch (err: any) {
      if (err.message?.includes('401')) {
        setError('נדרשת התחברות מחדש');
      } else {
        setError('שגיאה בטעינת נתונים');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'failure':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'running':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'timeout':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return 'הצלחה';
      case 'failure':
        return 'כשלון';
      case 'running':
        return 'רץ';
      case 'timeout':
        return 'פג זמן';
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-400">טוען נתונים...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !agent) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="glass rounded-xl p-8 text-center">
            <p className="text-red-200 mb-4">{error || 'סוכן לא נמצא'}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-all"
            >
              חזרה לדשבורד
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const domainColor = domainColors[agent.domain] || 'from-gray-500 to-slate-500';

  return (
    <DashboardLayout>
      {/* Back link */}
      <Link
        href="/dashboard"
        className="text-purple-400 hover:text-purple-300 transition-colors mb-6 inline-flex items-center gap-2 text-sm"
      >
        <span>←</span>
        חזרה לדשבורד
      </Link>

      {/* Agent Header */}
      <div className="glass rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${domainColor} flex items-center justify-center text-white text-2xl font-bold`}>
              {agent.nameHebrew.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">{agent.nameHebrew}</h1>
              <p className="text-gray-400 text-sm">{agent.name}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-gray-500 text-xs px-2 py-1 glass rounded-lg capitalize">{agent.domain}</span>
                <span className="text-gray-500 text-xs px-2 py-1 glass rounded-lg">Layer {agent.layer}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`px-4 py-2 rounded-lg font-medium text-sm ${
                agent.isEnabled
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
              }`}
            >
              {agent.isEnabled ? 'פעיל' : 'כבוי'}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-xl p-5">
          <p className="text-gray-400 text-xs mb-1">ריצות היום</p>
          <p className="text-2xl font-bold text-white">{agent.executionsToday}</p>
        </div>
        <div className="glass rounded-xl p-5">
          <p className="text-gray-400 text-xs mb-1">הצלחות</p>
          <p className="text-2xl font-bold text-green-400">{agent.successToday}</p>
        </div>
        <div className="glass rounded-xl p-5">
          <p className="text-gray-400 text-xs mb-1">כשלונות</p>
          <p className="text-2xl font-bold text-red-400">{agent.failuresToday}</p>
        </div>
        <div className="glass rounded-xl p-5">
          <p className="text-gray-400 text-xs mb-1">שיעור הצלחה</p>
          <p className={`text-2xl font-bold ${
            agent.successRate !== null && agent.successRate >= 80 ? 'text-green-400' :
            agent.successRate !== null && agent.successRate >= 50 ? 'text-yellow-400' :
            agent.successRate !== null ? 'text-red-400' : 'text-gray-400'
          }`}>
            {agent.successRate !== null ? `${Math.round(agent.successRate)}%` : 'N/A'}
          </p>
        </div>
      </div>

      {/* Extended Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="glass rounded-xl p-5">
            <p className="text-gray-400 text-xs mb-1">סה"כ ריצות (24שע)</p>
            <p className="text-xl font-bold text-white">{stats.totalExecutions}</p>
          </div>
          <div className="glass rounded-xl p-5">
            <p className="text-gray-400 text-xs mb-1">זמן ממוצע</p>
            <p className="text-xl font-bold text-white">{Math.round(stats.avgDuration)}ms</p>
          </div>
          <div className="glass rounded-xl p-5">
            <p className="text-gray-400 text-xs mb-1">זמן מינימלי</p>
            <p className="text-xl font-bold text-white">{Math.round(stats.minDuration)}ms</p>
          </div>
          <div className="glass rounded-xl p-5">
            <p className="text-gray-400 text-xs mb-1">זמן מקסימלי</p>
            <p className="text-xl font-bold text-white">{Math.round(stats.maxDuration)}ms</p>
          </div>
        </div>
      )}

      {/* Executions Table */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">היסטוריית ריצות</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-right text-gray-400 font-medium text-sm pb-3 pr-2">סטטוס</th>
                <th className="text-right text-gray-400 font-medium text-sm pb-3">התחלה</th>
                <th className="text-right text-gray-400 font-medium text-sm pb-3">משך זמן</th>
                <th className="text-right text-gray-400 font-medium text-sm pb-3">תקציר</th>
              </tr>
            </thead>
            <tbody>
              {executions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-gray-500 py-8">
                    אין ריצות עדיין
                  </td>
                </tr>
              ) : (
                executions.map((execution) => (
                  <tr key={execution.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 pr-2">
                      <span
                        className={`px-3 py-1 rounded-lg text-xs border ${getStatusBadge(execution.status)}`}
                      >
                        {getStatusText(execution.status)}
                      </span>
                    </td>
                    <td className="text-white text-sm py-3">
                      {new Date(execution.startedAt).toLocaleString('he-IL')}
                    </td>
                    <td className="text-white text-sm py-3">
                      {execution.duration ? `${Math.round(execution.duration)}ms` : 'N/A'}
                    </td>
                    <td className="text-gray-400 text-sm py-3 max-w-md">
                      <p className="truncate">
                        {execution.errorMessage ? (
                          <span className="text-red-400">{execution.errorMessage}</span>
                        ) : (
                          execution.outputSummary || execution.inputSummary || 'אין תקציר'
                        )}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
