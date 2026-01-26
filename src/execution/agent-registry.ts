/**
 * Agent Registry
 * Manages all registered agents
 */

import { logger } from '../utils/logger.js';
import type { IAgent, Intent, AgentRegistry as IAgentRegistry } from '../types/agent.types.js';

const log = logger.child({ component: 'AgentRegistry' });

class AgentRegistry implements IAgentRegistry {
  agents: Map<string, IAgent> = new Map();

  /**
   * Register an agent
   */
  register(agent: IAgent): void {
    if (this.agents.has(agent.id)) {
      log.warn('Agent already registered, replacing', { agentId: agent.id });
    }

    this.agents.set(agent.id, agent);
    log.info('Agent registered', {
      id: agent.id,
      name: agent.name,
      layer: agent.layer,
    });
  }

  /**
   * Get agent by ID
   */
  get(id: string): IAgent | undefined {
    return this.agents.get(id);
  }

  /**
   * Find best agent for an intent
   */
  findByIntent(intent: Intent): IAgent | undefined {
    let bestAgent: IAgent | undefined;
    let bestConfidence = 0;

    for (const agent of this.agents.values()) {
      if (agent.canHandle(intent)) {
        const confidence = agent.getConfidence(intent);
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestAgent = agent;
        }
      }
    }

    return bestAgent;
  }

  /**
   * Get all registered agents
   */
  getAll(): IAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by layer
   */
  getByLayer(layer: 0 | 1 | 2): IAgent[] {
    return this.getAll().filter((agent) => agent.layer === layer);
  }

  /**
   * Get agents by domain
   */
  getByDomain(domain: string): IAgent[] {
    return this.getAll().filter((agent) => agent.domain === domain);
  }
}

// Singleton instance
let registry: AgentRegistry | null = null;

export function getAgentRegistry(): AgentRegistry {
  if (!registry) {
    registry = new AgentRegistry();
  }
  return registry;
}

/**
 * Initialize registry with all agents
 */
export async function initializeAgents(): Promise<void> {
  const registry = getAgentRegistry();

  // Core agents
  const { EditorAgent } = await import('./agents/core/editor.agent.js');
  const { MediaStrategyAgent } = await import('./agents/media/strategy.agent.js');
  const { GeneralAssistantAgent } = await import('./agents/general/assistant.agent.js');

  // Proposals
  const { ClassicQuoteAgent } = await import('./agents/proposals/classic-quote.agent.js');
  const { ExistingClientQuoteAgent } = await import('./agents/proposals/existing-client-quote.agent.js');
  const { AnnualQuoteAgent } = await import('./agents/proposals/annual-quote.agent.js');
  const { AutoBriefFormAgent } = await import('./agents/proposals/auto-brief.agent.js');

  // Research
  const { PreMeetingResearchAgent } = await import('./agents/research/pre-meeting.agent.js');
  const { DeepResearchAgent } = await import('./agents/research/deep-research.agent.js');

  // Influencers
  const { InfluencerKPICalculatorAgent } = await import('./agents/influencers/kpi-calculator.agent.js');
  const { InfluencerResearchHubAgent } = await import('./agents/influencers/research-hub.agent.js');

  // Media
  const { MediaDeliverablesAgent } = await import('./agents/media/deliverables.agent.js');
  const { SeoGeoGeneratorAgent } = await import('./agents/media/seo-geo.agent.js');
  const { CompetitorMediaIntelAgent } = await import('./agents/media/competitor-media.agent.js');

  // Creative
  const { CreativeIdeasAgent } = await import('./agents/creative/ideas.agent.js');
  const { BrandBrainAgent } = await import('./agents/creative/brand-brain.agent.js');
  const { PlatformFormatterAgent } = await import('./agents/creative/platform-formatter.agent.js');
  const { WeeklyInspirationAgent } = await import('./agents/creative/weekly-inspiration.agent.js');

  // Operations
  const { MeetingSummaryAgent } = await import('./agents/operations/meeting-summary.agent.js');
  const { WeeklyStatusAgent } = await import('./agents/operations/weekly-status.agent.js');
  const { MeetingSchedulerAgent } = await import('./agents/operations/meeting-scheduler.agent.js');
  const { InstitutionalCommsAgent } = await import('./agents/operations/institutional.agent.js');
  const { SupplierMatchingAgent } = await import('./agents/operations/supplier-matching.agent.js');
  const { ProductionBudgetAgent } = await import('./agents/operations/production-budget.agent.js');
  const { BottleneckRadarAgent } = await import('./agents/operations/bottleneck-radar.agent.js');
  const { ProductionDeckAgent } = await import('./agents/operations/production-deck.agent.js');

  // Sales
  const { StuckDealsAgent } = await import('./agents/sales/stuck-deals.agent.js');
  const { SalesEmailReplyAgent } = await import('./agents/sales/email-reply.agent.js');
  const { CustomerSatisfactionAgent } = await import('./agents/sales/customer-satisfaction.agent.js');
  const { MultichannelCommsAgent } = await import('./agents/sales/multichannel.agent.js');

  // HR
  const { EmployeeSatisfactionAgent } = await import('./agents/hr/satisfaction.agent.js');
  const { HRFeedbackWriterAgent } = await import('./agents/hr/feedback-writer.agent.js');

  // Finance
  const { BillingControlAgent } = await import('./agents/finance/billing-control.agent.js');
  const { CashflowAgent } = await import('./agents/finance/cashflow.agent.js');

  // Executive
  const { CEOCommandAgent } = await import('./agents/executive/ceo-command.agent.js');

  // Register Core
  registry.register(new EditorAgent());
  registry.register(new MediaStrategyAgent());
  registry.register(new GeneralAssistantAgent());

  // Register Proposals
  registry.register(new ClassicQuoteAgent());
  registry.register(new ExistingClientQuoteAgent());
  registry.register(new AnnualQuoteAgent());
  registry.register(new AutoBriefFormAgent());

  // Register Research
  registry.register(new PreMeetingResearchAgent());
  registry.register(new DeepResearchAgent());

  // Register Influencers
  registry.register(new InfluencerKPICalculatorAgent());
  registry.register(new InfluencerResearchHubAgent());

  // Register Media
  registry.register(new MediaDeliverablesAgent());
  registry.register(new SeoGeoGeneratorAgent());
  registry.register(new CompetitorMediaIntelAgent());

  // Register Creative
  registry.register(new CreativeIdeasAgent());
  registry.register(new BrandBrainAgent());
  registry.register(new PlatformFormatterAgent());
  registry.register(new WeeklyInspirationAgent());

  // Register Operations
  registry.register(new MeetingSummaryAgent());
  registry.register(new WeeklyStatusAgent());
  registry.register(new MeetingSchedulerAgent());
  registry.register(new InstitutionalCommsAgent());
  registry.register(new SupplierMatchingAgent());
  registry.register(new ProductionBudgetAgent());
  registry.register(new BottleneckRadarAgent());
  registry.register(new ProductionDeckAgent());

  // Register Sales
  registry.register(new StuckDealsAgent());
  registry.register(new SalesEmailReplyAgent());
  registry.register(new CustomerSatisfactionAgent());
  registry.register(new MultichannelCommsAgent());

  // Register HR
  registry.register(new EmployeeSatisfactionAgent());
  registry.register(new HRFeedbackWriterAgent());

  // Register Finance
  registry.register(new BillingControlAgent());
  registry.register(new CashflowAgent());

  // Register Executive
  registry.register(new CEOCommandAgent());

  log.info('Agents initialized', { count: registry.getAll().length });
}

