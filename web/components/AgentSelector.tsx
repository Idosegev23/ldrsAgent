'use client';

import { useState, useRef, useEffect } from 'react';

interface Agent {
  id: string;
  name: string;
  nameHebrew: string;
  domain: string;
  description: string;
}

interface AgentSelectorProps {
  agents: Agent[];
  selectedAgent: string | null;
  onSelect: (agentId: string | null) => void;
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

export function AgentSelector({ agents, selectedAgent, onSelect }: AgentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedAgentData = agents.find(a => a.id === selectedAgent);
  
  const filteredAgents = agents.filter(agent =>
    agent.nameHebrew.includes(search) ||
    agent.name.toLowerCase().includes(search.toLowerCase()) ||
    agent.domain.includes(search)
  );

  // Group by domain
  const groupedAgents = filteredAgents.reduce((acc, agent) => {
    const domain = agent.domain;
    if (!acc[domain]) acc[domain] = [];
    acc[domain].push(agent);
    return acc;
  }, {} as Record<string, Agent[]>);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="glass px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-white/10 transition-colors min-w-[200px]"
      >
        {selectedAgentData ? (
          <>
            <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${domainColors[selectedAgentData.domain] || domainColors.general}`} />
            <span className="text-white">{selectedAgentData.nameHebrew}</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-white/60">מצב אוטומטי</span>
          </>
        )}
        <svg className={`w-4 h-4 text-white/60 mr-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 glass rounded-xl overflow-hidden shadow-2xl z-50 animate-fadeIn">
          {/* Search */}
          <div className="p-3 border-b border-white/10">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חפש סוכן..."
              className="w-full bg-white/5 text-white placeholder-white/40 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* Auto mode option */}
          <button
            onClick={() => {
              onSelect(null);
              setIsOpen(false);
            }}
            className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors ${
              !selectedAgent ? 'bg-white/10' : ''
            }`}
          >
            <svg className="w-5 h-5 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div className="text-right">
              <div className="text-white font-medium">מצב אוטומטי</div>
              <div className="text-white/50 text-xs">המערכת תבחר את הסוכן המתאים</div>
            </div>
          </button>

          {/* Agents by domain */}
          <div className="max-h-[400px] overflow-y-auto">
            {Object.entries(groupedAgents).map(([domain, domainAgents]) => (
              <div key={domain}>
                <div className="px-4 py-2 text-xs font-medium text-white/50 bg-white/5">
                  {domainLabels[domain] || domain}
                </div>
                {domainAgents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      onSelect(agent.id);
                      setIsOpen(false);
                    }}
                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors ${
                      selectedAgent === agent.id ? 'bg-white/10' : ''
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${domainColors[domain] || domainColors.general}`} />
                    <div className="text-right flex-1">
                      <div className="text-white">{agent.nameHebrew}</div>
                      <div className="text-white/50 text-xs truncate">{agent.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
