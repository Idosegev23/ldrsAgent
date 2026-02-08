/**
 * Serverless-compatible Agent Registry
 * Static registry - no dynamic loading
 */

export interface AgentInfo {
  id: string;
  name: string;
  nameHebrew: string;
  domain: string;
  description: string;
  executionsToday?: number;
}

// Static agent definitions
const AGENTS: AgentInfo[] = [
  {
    id: 'ceo-command',
    name: 'CEO Command Center',
    nameHebrew: 'מרכז פיקוד מנכ"ל',
    domain: 'executive',
    description: 'Strategic decision making and high-level operations',
  },
  {
    id: 'sales-multichannel',
    name: 'Multichannel Sales',
    nameHebrew: 'מכירות רב-ערוצי',
    domain: 'sales',
    description: 'Cross-platform sales automation and lead management',
  },
  {
    id: 'proposal-classic',
    name: 'Classic Proposal Generator',
    nameHebrew: 'מחולל הצעות מחיר קלאסי',
    domain: 'proposals',
    description: 'Professional proposal generation',
  },
  {
    id: 'media-strategy',
    name: 'Media Strategy Planner',
    nameHebrew: 'תכנון אסטרטגיה תקשורתית',
    domain: 'media',
    description: 'Media planning and strategy development',
  },
  {
    id: 'creative-ideas',
    name: 'Creative Ideas Generator',
    nameHebrew: 'מחולל רעיונות יצירתי',
    domain: 'creative',
    description: 'Generate creative content ideas',
  },
];

export function getAgentRegistry() {
  return {
    getAllAgents: () => AGENTS,
    getAgent: (id: string) => AGENTS.find(a => a.id === id),
  };
}
