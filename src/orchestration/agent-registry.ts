/**
 * Agent Registry
 * Central knowledge base about agent capabilities and usage patterns
 */

import type { Tool } from './tool-discovery.js';
import { logger } from '../utils/logger.js';

export interface AgentCapability {
  name: string;
  description: string;
  examples: string[];
  confidence: number; // 0-1
}

export interface AgentPerformance {
  agentId: string;
  executionCount: number;
  successCount: number;
  failureCount: number;
  averageDurationMs: number;
  averageTokens: number;
  lastUsed?: Date;
  successRate: number;
}

export interface AgentMetadata {
  agentId: string;
  name: string;
  description: string;
  category: string;
  capabilities: AgentCapability[];
  performance: AgentPerformance;
  tags: string[];
  dependencies: string[]; // Other agents or integrations required
  estimatedCost: number;
  priority: number;
}

export class AgentRegistry {
  private registry: Map<string, AgentMetadata>;
  private performanceData: Map<string, AgentPerformance>;

  constructor() {
    this.registry = new Map();
    this.performanceData = new Map();
  }

  /**
   * Register agent
   */
  register(metadata: AgentMetadata): void {
    this.registry.set(metadata.agentId, metadata);
    
    if (!this.performanceData.has(metadata.agentId)) {
      this.performanceData.set(metadata.agentId, {
        agentId: metadata.agentId,
        executionCount: 0,
        successCount: 0,
        failureCount: 0,
        averageDurationMs: 0,
        averageTokens: 0,
        successRate: 0
      });
    }

    logger.info('Agent registered', {
      agentId: metadata.agentId,
      name: metadata.name
    });
  }

  /**
   * Get agent metadata
   */
  getAgent(agentId: string): AgentMetadata | undefined {
    return this.registry.get(agentId);
  }

  /**
   * Get all agents
   */
  getAllAgents(): AgentMetadata[] {
    return Array.from(this.registry.values());
  }

  /**
   * Get agents by category
   */
  getAgentsByCategory(category: string): AgentMetadata[] {
    return Array.from(this.registry.values()).filter(
      agent => agent.category === category
    );
  }

  /**
   * Get agents by capability
   */
  getAgentsByCapability(capability: string): AgentMetadata[] {
    return Array.from(this.registry.values()).filter(agent =>
      agent.capabilities.some(cap =>
        cap.name.toLowerCase().includes(capability.toLowerCase()) ||
        cap.description.toLowerCase().includes(capability.toLowerCase())
      )
    );
  }

  /**
   * Find best agent for task
   */
  findBestAgent(
    task: string,
    requirements: string[] = [],
    excludeAgents: string[] = []
  ): AgentMetadata | null {
    const candidates = Array.from(this.registry.values())
      .filter(agent => !excludeAgents.includes(agent.agentId));

    if (candidates.length === 0) {
      return null;
    }

    // Score each agent
    const scored = candidates.map(agent => {
      const performance = this.performanceData.get(agent.agentId);
      
      let score = 0;

      // Capability match
      const taskLower = task.toLowerCase();
      for (const cap of agent.capabilities) {
        if (taskLower.includes(cap.name.toLowerCase())) {
          score += cap.confidence * 10;
        }
        if (cap.description.toLowerCase().includes(taskLower)) {
          score += cap.confidence * 5;
        }
      }

      // Requirements match
      for (const req of requirements) {
        const reqLower = req.toLowerCase();
        for (const cap of agent.capabilities) {
          if (cap.name.toLowerCase().includes(reqLower)) {
            score += 5;
          }
        }
      }

      // Performance bonus
      if (performance) {
        score += performance.successRate * 3;
        if (performance.executionCount > 10) {
          score += 2; // Experience bonus
        }
      }

      // Priority bonus
      score += agent.priority;

      return { agent, score };
    });

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    
    logger.info('Found best agent for task', {
      task: task.substring(0, 50),
      agentId: best.agent.agentId,
      score: best.score
    });

    return best.agent;
  }

  /**
   * Record agent execution
   */
  recordExecution(
    agentId: string,
    success: boolean,
    durationMs: number,
    tokensUsed: number
  ): void {
    const performance = this.performanceData.get(agentId);
    
    if (!performance) {
      logger.warn('Agent performance data not found', { agentId });
      return;
    }

    // Update counts
    performance.executionCount++;
    if (success) {
      performance.successCount++;
    } else {
      performance.failureCount++;
    }

    // Update averages
    const totalExecutions = performance.executionCount;
    performance.averageDurationMs = 
      (performance.averageDurationMs * (totalExecutions - 1) + durationMs) / totalExecutions;
    performance.averageTokens = 
      (performance.averageTokens * (totalExecutions - 1) + tokensUsed) / totalExecutions;

    // Update success rate
    performance.successRate = performance.successCount / performance.executionCount;
    performance.lastUsed = new Date();

    // Update registry
    const metadata = this.registry.get(agentId);
    if (metadata) {
      metadata.performance = performance;
    }
  }

  /**
   * Get agent performance
   */
  getPerformance(agentId: string): AgentPerformance | undefined {
    return this.performanceData.get(agentId);
  }

  /**
   * Get top performing agents
   */
  getTopPerformers(limit: number = 10): AgentMetadata[] {
    return Array.from(this.registry.values())
      .sort((a, b) => {
        const perfA = this.performanceData.get(a.agentId);
        const perfB = this.performanceData.get(b.agentId);
        
        if (!perfA || !perfB) return 0;
        
        // Sort by success rate, then by execution count
        if (perfB.successRate !== perfA.successRate) {
          return perfB.successRate - perfA.successRate;
        }
        return perfB.executionCount - perfA.executionCount;
      })
      .slice(0, limit);
  }

  /**
   * Get agent statistics
   */
  getStatistics(): {
    totalAgents: number;
    totalExecutions: number;
    averageSuccessRate: number;
    topCategory: string;
  } {
    const totalAgents = this.registry.size;
    let totalExecutions = 0;
    let totalSuccesses = 0;
    const categories = new Map<string, number>();

    for (const performance of this.performanceData.values()) {
      totalExecutions += performance.executionCount;
      totalSuccesses += performance.successCount;
    }

    for (const agent of this.registry.values()) {
      categories.set(agent.category, (categories.get(agent.category) || 0) + 1);
    }

    const topCategory = Array.from(categories.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

    const averageSuccessRate = totalExecutions > 0 
      ? totalSuccesses / totalExecutions 
      : 0;

    return {
      totalAgents,
      totalExecutions,
      averageSuccessRate,
      topCategory
    };
  }

  /**
   * Import agents from tool discovery
   */
  importFromTools(tools: Tool[]): void {
    for (const tool of tools) {
      if (tool.type !== 'AGENT') continue;

      const metadata: AgentMetadata = {
        agentId: tool.id,
        name: tool.name,
        description: tool.description,
        category: tool.metadata.category || 'general',
        capabilities: tool.capabilities.map(cap => ({
          name: cap,
          description: cap,
          examples: [],
          confidence: 0.8
        })),
        performance: this.performanceData.get(tool.id) || {
          agentId: tool.id,
          executionCount: 0,
          successCount: 0,
          failureCount: 0,
          averageDurationMs: 0,
          averageTokens: 0,
          successRate: 0
        },
        tags: tool.capabilities,
        dependencies: [],
        estimatedCost: tool.metadata.estimatedCost || 100,
        priority: 5
      };

      this.register(metadata);
    }

    logger.info('Imported agents from tool discovery', {
      count: tools.filter(t => t.type === 'AGENT').length
    });
  }

  /**
   * Save registry to database
   */
  async save(): Promise<void> {
    // TODO: Implement database persistence
    logger.info('Saving agent registry', { count: this.registry.size });
  }

  /**
   * Load registry from database
   */
  async load(): Promise<void> {
    // TODO: Implement database loading
    logger.info('Loading agent registry from database');
  }
}

// Singleton instance
export const agentRegistry = new AgentRegistry();
