'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { apiGet } from '@/lib/api';

interface Agent {
  id: string;
  name: string;
  nameHebrew: string;
  domain: string;
  description: string;
  capabilities: string[];
  layer: number;
}

const domainColors: Record<string, string> = {
  general: 'from-gray-500 to-gray-600',
  sales: 'from-green-500 to-green-600',
  hr: 'from-blue-500 to-blue-600',
  finance: 'from-yellow-500 to-yellow-600',
  media: 'from-purple-500 to-purple-600',
  creative: 'from-pink-500 to-pink-600',
  research: 'from-cyan-500 to-cyan-600',
  influencers: 'from-orange-500 to-orange-600',
  proposals: 'from-indigo-500 to-indigo-600',
  operations: 'from-teal-500 to-teal-600',
  executive: 'from-red-500 to-red-600',
};

const domainLabels: Record<string, string> = {
  general: 'כללי',
  sales: 'מכירות',
  hr: 'משאבי אנוש',
  finance: 'כספים',
  media: 'מדיה',
  creative: 'קריאייטיב',
  research: 'מחקר',
  influencers: 'משפיענים',
  proposals: 'הצעות מחיר',
  operations: 'תפעול',
  executive: 'הנהלה',
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const data = await apiGet<{ success: boolean; agents: Agent[] }>('/api/agents');
      if (data.success) {
        setAgents(data.agents);
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = !filter || 
      agent.nameHebrew.includes(filter) ||
      agent.name.toLowerCase().includes(filter.toLowerCase()) ||
      agent.description.includes(filter);
    
    const matchesDomain = !selectedDomain || agent.domain === selectedDomain;
    
    return matchesSearch && matchesDomain;
  });

  const domains = Array.from(new Set(agents.map(a => a.domain)));

  return (
    <div className="flex h-screen">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="glass border-b border-white/10 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-white">סוכנים</h1>
              <span className="text-white/50">({agents.length})</span>
            </div>
          </div>
        </header>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-white/10">
          <div className="flex flex-wrap gap-4">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="חפש סוכן..."
              className="flex-1 min-w-[200px] glass px-4 py-2 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedDomain(null)}
                className={`px-3 py-2 rounded-lg transition-colors ${
                  !selectedDomain ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                הכל
              </button>
              {domains.map(domain => (
                <button
                  key={domain}
                  onClick={() => setSelectedDomain(domain === selectedDomain ? null : domain)}
                  className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                    selectedDomain === domain ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${domainColors[domain]}`} />
                  {domainLabels[domain] || domain}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Agents grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAgents.map(agent => (
                <div
                  key={agent.id}
                  className="glass rounded-2xl p-5 hover:bg-white/10 transition-all duration-200 animate-fadeIn"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${domainColors[agent.domain]} flex items-center justify-center flex-shrink-0`}>
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">{agent.nameHebrew}</h3>
                      <p className="text-white/50 text-sm">{domainLabels[agent.domain]}</p>
                    </div>
                  </div>
                  
                  <p className="text-white/60 text-sm mb-4 line-clamp-2">
                    {agent.description}
                  </p>

                  <div className="flex flex-wrap gap-1">
                    {agent.capabilities.slice(0, 3).map(cap => (
                      <span
                        key={cap}
                        className="px-2 py-1 rounded-full bg-white/5 text-white/50 text-xs"
                      >
                        {cap}
                      </span>
                    ))}
                    {agent.capabilities.length > 3 && (
                      <span className="px-2 py-1 rounded-full bg-white/5 text-white/50 text-xs">
                        +{agent.capabilities.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
