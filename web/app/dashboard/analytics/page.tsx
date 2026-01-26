'use client';

/**
 * Analytics Page
 * System-wide analytics and insights
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '../../../components/DashboardLayout';
import { apiGet } from '@/lib/api';

interface AgentPerformance {
  id: string;
  name: string;
  nameHebrew: string;
  domain: string;
  executionsToday: number;
  successToday: number;
  failuresToday: number;
  successRate: number | null;
  avgDuration: number | null;
}

export default function AnalyticsPage() {
  const [agents, setAgents] = useState<AgentPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      const data = await apiGet<{ success: boolean; agents: AgentPerformance[]; total: number }>('/api/dashboard/agents');
      setAgents(data.agents || []);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch analytics:', err);
      if (err.message?.includes('403')) {
        setError('אין לך הרשאה לצפות בדף זה');
      } else {
        setError('שגיאה בטעינת נתונים');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate totals
  const totalExecutions = agents.reduce((sum, a) => sum + a.executionsToday, 0);
  const totalSuccess = agents.reduce((sum, a) => sum + a.successToday, 0);
  const totalFailures = agents.reduce((sum, a) => sum + a.failuresToday, 0);
  const overallSuccessRate = totalExecutions > 0 ? Math.round((totalSuccess / totalExecutions) * 100) : 0;

  // Sort agents for rankings
  const topPerformers = [...agents]
    .filter((a) => a.successRate !== null && a.executionsToday > 0)
    .sort((a, b) => (b.successRate || 0) - (a.successRate || 0))
    .slice(0, 10);

  const mostActive = [...agents]
    .filter((a) => a.executionsToday > 0)
    .sort((a, b) => b.executionsToday - a.executionsToday)
    .slice(0, 10);

  const fastest = [...agents]
    .filter((a) => a.avgDuration !== null && a.avgDuration > 0)
    .sort((a, b) => (a.avgDuration || Infinity) - (b.avgDuration || Infinity))
    .slice(0, 10);

  const needsAttention = [...agents]
    .filter((a) => a.failuresToday > 0)
    .sort((a, b) => b.failuresToday - a.failuresToday)
    .slice(0, 5);

  // Domain stats
  const domainStats = agents.reduce((acc, agent) => {
    if (!acc[agent.domain]) {
      acc[agent.domain] = { executions: 0, success: 0, failures: 0 };
    }
    acc[agent.domain].executions += agent.executionsToday;
    acc[agent.domain].success += agent.successToday;
    acc[agent.domain].failures += agent.failuresToday;
    return acc;
  }, {} as Record<string, { executions: number; success: number; failures: number }>);

  return (
    <DashboardLayout title="אנליטיקה" subtitle="ניתוח ביצועים והתנהגות של הסוכנים">
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-400">טוען נתונים...</p>
          </div>
        </div>
      ) : error ? (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-red-200 mb-4">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-all"
          >
            נסה שוב
          </button>
        </div>
      ) : (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="glass rounded-xl p-5">
              <p className="text-gray-400 text-xs mb-1">סה"כ ריצות היום</p>
              <p className="text-3xl font-bold text-white">{totalExecutions}</p>
            </div>
            <div className="glass rounded-xl p-5">
              <p className="text-gray-400 text-xs mb-1">הצלחות</p>
              <p className="text-3xl font-bold text-green-400">{totalSuccess}</p>
            </div>
            <div className="glass rounded-xl p-5">
              <p className="text-gray-400 text-xs mb-1">כשלונות</p>
              <p className="text-3xl font-bold text-red-400">{totalFailures}</p>
            </div>
            <div className="glass rounded-xl p-5">
              <p className="text-gray-400 text-xs mb-1">שיעור הצלחה כולל</p>
              <p className={`text-3xl font-bold ${overallSuccessRate >= 80 ? 'text-green-400' : overallSuccessRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                {overallSuccessRate}%
              </p>
            </div>
          </div>

          {/* Needs Attention */}
          {needsAttention.length > 0 && (
            <div className="glass rounded-xl p-5 mb-8 border border-red-500/20 bg-red-500/5">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-red-400">!</span>
                דורשים תשומת לב
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {needsAttention.map((agent) => (
                  <Link
                    key={agent.id}
                    href={`/dashboard/agents/${agent.id}`}
                    className="glass rounded-lg p-3 hover:bg-white/5 transition-all"
                  >
                    <p className="text-white font-medium text-sm truncate">{agent.nameHebrew}</p>
                    <p className="text-red-400 text-xs">{agent.failuresToday} כשלונות</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Rankings Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Top Performers */}
            <div className="glass rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🏆</span>
                <div>
                  <h2 className="text-lg font-semibold text-white">מובילים</h2>
                  <p className="text-gray-500 text-xs">לפי שיעור הצלחה</p>
                </div>
              </div>
              <div className="space-y-2">
                {topPerformers.length === 0 ? (
                  <p className="text-gray-500 text-center py-4 text-sm">אין נתונים</p>
                ) : (
                  topPerformers.map((agent, index) => (
                    <Link
                      key={agent.id}
                      href={`/dashboard/agents/${agent.id}`}
                      className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-500 text-black' :
                          index === 1 ? 'bg-gray-400 text-black' :
                          index === 2 ? 'bg-amber-600 text-white' :
                          'bg-gray-700 text-gray-300'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="text-white text-sm truncate max-w-[120px]">{agent.nameHebrew}</span>
                      </div>
                      <span className="text-green-400 font-semibold text-sm">
                        {Math.round(agent.successRate || 0)}%
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Most Active */}
            <div className="glass rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🔥</span>
                <div>
                  <h2 className="text-lg font-semibold text-white">הכי פעילים</h2>
                  <p className="text-gray-500 text-xs">לפי מספר ריצות</p>
                </div>
              </div>
              <div className="space-y-2">
                {mostActive.length === 0 ? (
                  <p className="text-gray-500 text-center py-4 text-sm">אין נתונים</p>
                ) : (
                  mostActive.map((agent, index) => (
                    <Link
                      key={agent.id}
                      href={`/dashboard/agents/${agent.id}`}
                      className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-blue-500 text-white' :
                          index === 1 ? 'bg-blue-600 text-white' :
                          index === 2 ? 'bg-blue-700 text-white' :
                          'bg-gray-700 text-gray-300'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="text-white text-sm truncate max-w-[120px]">{agent.nameHebrew}</span>
                      </div>
                      <span className="text-blue-400 font-semibold text-sm">
                        {agent.executionsToday}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Fastest */}
            <div className="glass rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">⚡</span>
                <div>
                  <h2 className="text-lg font-semibold text-white">הכי מהירים</h2>
                  <p className="text-gray-500 text-xs">לפי זמן תגובה</p>
                </div>
              </div>
              <div className="space-y-2">
                {fastest.length === 0 ? (
                  <p className="text-gray-500 text-center py-4 text-sm">אין נתונים</p>
                ) : (
                  fastest.map((agent, index) => (
                    <Link
                      key={agent.id}
                      href={`/dashboard/agents/${agent.id}`}
                      className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-500 text-black' :
                          index === 1 ? 'bg-yellow-600 text-white' :
                          index === 2 ? 'bg-yellow-700 text-white' :
                          'bg-gray-700 text-gray-300'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="text-white text-sm truncate max-w-[120px]">{agent.nameHebrew}</span>
                      </div>
                      <span className="text-yellow-400 font-semibold text-sm">
                        {Math.round(agent.avgDuration || 0)}ms
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Domain Stats */}
          <div className="glass rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4">ביצועים לפי תחום</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {Object.entries(domainStats).map(([domain, stats]) => (
                <div key={domain} className="glass rounded-lg p-3 text-center">
                  <p className="text-white font-medium text-sm capitalize mb-2">{domain}</p>
                  <div className="flex justify-center gap-3 text-xs">
                    <span className="text-gray-400">{stats.executions}</span>
                    <span className="text-green-400">{stats.success}</span>
                    <span className="text-red-400">{stats.failures}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
