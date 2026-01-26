/**
 * Tool Discovery System
 * Dynamically scans and catalogs available agents, integrations, and actions
 */

import type { Agent } from '../types/agent.types.js';
import { logger } from '../utils/logger.js';
import { glob } from 'glob';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface Tool {
  id: string;
  type: 'AGENT' | 'INTEGRATION' | 'ACTION';
  name: string;
  description: string;
  capabilities: string[];
  parameters?: ToolParameter[];
  metadata: Record<string, any>;
  lastDiscoveredAt: Date;
}

export interface ToolParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: any;
}

export class ToolDiscovery {
  private tools: Map<string, Tool>;
  private lastScanTime?: Date;

  constructor() {
    this.tools = new Map();
  }

  /**
   * Scan and discover all available tools
   */
  async discover(): Promise<Tool[]> {
    logger.info('Starting tool discovery');
    const startTime = Date.now();

    try {
      // Clear existing tools
      this.tools.clear();

      // Discover agents
      await this.discoverAgents();

      // Discover integrations
      await this.discoverIntegrations();

      // Discover actions
      await this.discoverActions();

      this.lastScanTime = new Date();
      const durationMs = Date.now() - startTime;

      logger.info('Tool discovery completed', {
        totalTools: this.tools.size,
        durationMs
      });

      return Array.from(this.tools.values());
    } catch (error) {
      logger.error('Tool discovery failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Discover agents
   */
  private async discoverAgents(): Promise<void> {
    try {
      const agentsPath = path.join(__dirname, '../execution/agents');
      
      // Find all agent files
      const agentFiles = await glob('**/*.agent.{ts,js}', {
        cwd: agentsPath,
        absolute: true
      });

      logger.info('Discovering agents', { count: agentFiles.length });

      for (const agentFile of agentFiles) {
        try {
          // Import agent module
          const module = await import(agentFile);
          const agentClass = module.default || Object.values(module)[0];

          if (!agentClass || typeof agentClass !== 'function') {
            continue;
          }

          // Get agent metadata
          const agentInstance = new (agentClass as any)();
          const metadata = agentInstance.metadata || {};

          const tool: Tool = {
            id: metadata.id || this.extractAgentId(agentFile),
            type: 'AGENT',
            name: metadata.name || 'Unknown Agent',
            description: metadata.description || 'No description available',
            capabilities: metadata.capabilities || [],
            parameters: metadata.parameters || [],
            metadata: {
              category: metadata.category || 'general',
              complexity: metadata.complexity || 'medium',
              estimatedDuration: metadata.estimatedDuration,
              requiresApproval: metadata.requiresApproval || false,
              filePath: agentFile
            },
            lastDiscoveredAt: new Date()
          };

          this.tools.set(tool.id, tool);
        } catch (error) {
          logger.warn('Failed to load agent', {
            file: agentFile,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    } catch (error) {
      logger.error('Failed to discover agents', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Discover integrations
   */
  private async discoverIntegrations(): Promise<void> {
    try {
      const integrationsPath = path.join(__dirname, '../integrations/connectors');
      
      // Find all connector files
      const connectorFiles = await glob('*.connector.{ts,js}', {
        cwd: integrationsPath,
        absolute: true
      });

      logger.info('Discovering integrations', { count: connectorFiles.length });

      for (const connectorFile of connectorFiles) {
        try {
          const module = await import(connectorFile);
          const connectorName = path.basename(connectorFile, '.connector.ts');

          // Extract methods from connector
          const connector = module.default || module[connectorName] || Object.values(module)[0];
          
          if (!connector || typeof connector !== 'object') {
            continue;
          }

          // Get available methods
          const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(connector))
            .filter(name => name !== 'constructor' && typeof connector[name] === 'function');

          const tool: Tool = {
            id: `integration-${connectorName}`,
            type: 'INTEGRATION',
            name: `${connectorName.charAt(0).toUpperCase() + connectorName.slice(1)} Integration`,
            description: `Integration with ${connectorName}`,
            capabilities: methods,
            metadata: {
              connector: connectorName,
              methods,
              filePath: connectorFile
            },
            lastDiscoveredAt: new Date()
          };

          this.tools.set(tool.id, tool);
        } catch (error) {
          logger.warn('Failed to load connector', {
            file: connectorFile,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    } catch (error) {
      logger.error('Failed to discover integrations', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Discover actions
   */
  private async discoverActions(): Promise<void> {
    // Predefined actions
    const actions: Tool[] = [
      {
        id: 'action-send-email',
        type: 'ACTION',
        name: 'Send Email',
        description: 'Send an email via Gmail',
        capabilities: ['email', 'communication'],
        parameters: [
          { name: 'to', type: 'string[]', required: true, description: 'Recipients' },
          { name: 'subject', type: 'string', required: true, description: 'Email subject' },
          { name: 'body', type: 'string', required: true, description: 'Email body' }
        ],
        metadata: {
          requiresApproval: true,
          integration: 'gmail'
        },
        lastDiscoveredAt: new Date()
      },
      {
        id: 'action-create-calendar-event',
        type: 'ACTION',
        name: 'Create Calendar Event',
        description: 'Create a Google Calendar event',
        capabilities: ['calendar', 'scheduling'],
        parameters: [
          { name: 'title', type: 'string', required: true, description: 'Event title' },
          { name: 'start', type: 'datetime', required: true, description: 'Start time' },
          { name: 'end', type: 'datetime', required: true, description: 'End time' },
          { name: 'attendees', type: 'string[]', required: false, description: 'Attendees' }
        ],
        metadata: {
          requiresApproval: true,
          integration: 'calendar'
        },
        lastDiscoveredAt: new Date()
      },
      {
        id: 'action-create-task',
        type: 'ACTION',
        name: 'Create Task',
        description: 'Create a task in ClickUp',
        capabilities: ['task-management', 'productivity'],
        parameters: [
          { name: 'name', type: 'string', required: true, description: 'Task name' },
          { name: 'description', type: 'string', required: false, description: 'Task description' },
          { name: 'assignee', type: 'string', required: false, description: 'Assignee' }
        ],
        metadata: {
          integration: 'clickup'
        },
        lastDiscoveredAt: new Date()
      },
      {
        id: 'action-search-drive',
        type: 'ACTION',
        name: 'Search Drive',
        description: 'Search for files in Google Drive',
        capabilities: ['search', 'files'],
        parameters: [
          { name: 'query', type: 'string', required: true, description: 'Search query' },
          { name: 'mimeType', type: 'string', required: false, description: 'File type filter' }
        ],
        metadata: {
          integration: 'drive'
        },
        lastDiscoveredAt: new Date()
      }
    ];

    for (const action of actions) {
      this.tools.set(action.id, action);
    }
  }

  /**
   * Extract agent ID from file path
   */
  private extractAgentId(filePath: string): string {
    const fileName = path.basename(filePath, '.agent.ts');
    return fileName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  }

  /**
   * Get tool by ID
   */
  getTool(id: string): Tool | undefined {
    return this.tools.get(id);
  }

  /**
   * Get all tools
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by type
   */
  getToolsByType(type: Tool['type']): Tool[] {
    return Array.from(this.tools.values()).filter(tool => tool.type === type);
  }

  /**
   * Get tools by capability
   */
  getToolsByCapability(capability: string): Tool[] {
    return Array.from(this.tools.values()).filter(tool =>
      tool.capabilities.some(cap => 
        cap.toLowerCase().includes(capability.toLowerCase())
      )
    );
  }

  /**
   * Search tools
   */
  searchTools(query: string): Tool[] {
    const lowerQuery = query.toLowerCase();
    
    return Array.from(this.tools.values()).filter(tool =>
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.description.toLowerCase().includes(lowerQuery) ||
      tool.capabilities.some(cap => cap.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get last scan time
   */
  getLastScanTime(): Date | undefined {
    return this.lastScanTime;
  }

  /**
   * Get tools count
   */
  getToolsCount(): number {
    return this.tools.size;
  }

  /**
   * Save catalog to database
   */
  async saveCatalog(): Promise<void> {
    // TODO: Implement database persistence
    logger.info('Saving tool catalog', { count: this.tools.size });
  }

  /**
   * Load catalog from database
   */
  async loadCatalog(): Promise<void> {
    // TODO: Implement database loading
    logger.info('Loading tool catalog from database');
  }
}

// Singleton instance
export const toolDiscovery = new ToolDiscovery();
