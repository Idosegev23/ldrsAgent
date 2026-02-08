/**
 * Serverless-compatible Intent Classifier
 * Lightweight classification without heavy dependencies
 */

export interface Intent {
  type: string;
  confidence: number;
  suggestedAgent?: string;
}

export async function classifyIntent(input: string): Promise<Intent> {
  const lower = input.toLowerCase();
  
  // Simple keyword-based classification
  if (lower.includes('הצעת מחיר') || lower.includes('proposal') || lower.includes('quote')) {
    return {
      type: 'proposal',
      confidence: 0.9,
      suggestedAgent: 'proposal-classic',
    };
  }
  
  if (lower.includes('מכירות') || lower.includes('sales') || lower.includes('לקוחות')) {
    return {
      type: 'sales',
      confidence: 0.85,
      suggestedAgent: 'sales-multichannel',
    };
  }
  
  if (lower.includes('תוכן') || lower.includes('content') || lower.includes('רעיונות')) {
    return {
      type: 'creative',
      confidence: 0.8,
      suggestedAgent: 'creative-ideas',
    };
  }
  
  if (lower.includes('אסטרטגיה') || lower.includes('strategy') || lower.includes('תכנון')) {
    return {
      type: 'strategy',
      confidence: 0.85,
      suggestedAgent: 'media-strategy',
    };
  }
  
  // Default to general assistance
  return {
    type: 'general',
    confidence: 0.5,
    suggestedAgent: 'ceo-command',
  };
}
