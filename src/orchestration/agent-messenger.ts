/**
 * Agent Messenger
 * Inter-agent communication system
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export type MessageType = 
  | 'REQUEST'
  | 'RESPONSE'
  | 'NOTIFICATION'
  | 'QUERY'
  | 'DATA_SHARE';

export interface AgentMessage {
  id: string;
  executionId: string;
  fromAgent: string;
  toAgent: string;
  type: MessageType;
  payload: any;
  inReplyTo?: string;
  timestamp: Date;
  expiresAt?: Date;
}

export interface MessageHandler {
  (message: AgentMessage): Promise<any> | any;
}

export class AgentMessenger extends EventEmitter {
  private messages: Map<string, AgentMessage>;
  private handlers: Map<string, Map<MessageType, MessageHandler>>;
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeoutId: NodeJS.Timeout;
  }>;

  constructor() {
    super();
    this.messages = new Map();
    this.handlers = new Map();
    this.pendingRequests = new Map();
  }

  /**
   * Register message handler for agent
   */
  registerHandler(
    agentId: string,
    messageType: MessageType,
    handler: MessageHandler
  ): void {
    if (!this.handlers.has(agentId)) {
      this.handlers.set(agentId, new Map());
    }

    this.handlers.get(agentId)!.set(messageType, handler);

    logger.debug('Message handler registered', {
      agentId,
      messageType
    });
  }

  /**
   * Send message to another agent
   */
  async send(
    executionId: string,
    fromAgent: string,
    toAgent: string,
    type: MessageType,
    payload: any,
    options?: {
      expiresAt?: Date;
      inReplyTo?: string;
    }
  ): Promise<string> {
    const message: AgentMessage = {
      id: uuidv4(),
      executionId,
      fromAgent,
      toAgent,
      type,
      payload,
      inReplyTo: options?.inReplyTo,
      timestamp: new Date(),
      expiresAt: options?.expiresAt
    };

    // Store message
    this.messages.set(message.id, message);

    // Emit event
    this.emit('message', message);

    // Deliver to agent
    await this.deliverMessage(message);

    logger.info('Message sent', {
      messageId: message.id,
      executionId,
      fromAgent,
      toAgent,
      type
    });

    return message.id;
  }

  /**
   * Send request and wait for response
   */
  async request(
    executionId: string,
    fromAgent: string,
    toAgent: string,
    payload: any,
    timeoutMs: number = 30000
  ): Promise<any> {
    const messageId = await this.send(
      executionId,
      fromAgent,
      toAgent,
      'REQUEST',
      payload
    );

    // Create promise for response
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(messageId);
        reject(new Error(`Request timeout: ${messageId}`));
      }, timeoutMs);

      this.pendingRequests.set(messageId, {
        resolve,
        reject,
        timeoutId
      });
    });
  }

  /**
   * Reply to a message
   */
  async reply(
    message: AgentMessage,
    fromAgent: string,
    payload: any
  ): Promise<void> {
    await this.send(
      message.executionId,
      fromAgent,
      message.fromAgent, // Reply to sender
      'RESPONSE',
      payload,
      { inReplyTo: message.id }
    );

    // Resolve pending request if exists
    const pending = this.pendingRequests.get(message.id);
    if (pending) {
      clearTimeout(pending.timeoutId);
      pending.resolve(payload);
      this.pendingRequests.delete(message.id);
    }
  }

  /**
   * Broadcast message to all agents
   */
  async broadcast(
    executionId: string,
    fromAgent: string,
    type: MessageType,
    payload: any
  ): Promise<string[]> {
    const messageIds: string[] = [];

    // Get all registered agents except sender
    const agentIds = Array.from(this.handlers.keys()).filter(id => id !== fromAgent);

    for (const agentId of agentIds) {
      const messageId = await this.send(
        executionId,
        fromAgent,
        agentId,
        type,
        payload
      );
      messageIds.push(messageId);
    }

    logger.info('Message broadcast', {
      executionId,
      fromAgent,
      recipientCount: agentIds.length
    });

    return messageIds;
  }

  /**
   * Deliver message to agent
   */
  private async deliverMessage(message: AgentMessage): Promise<void> {
    const agentHandlers = this.handlers.get(message.toAgent);
    
    if (!agentHandlers) {
      logger.warn('No handlers registered for agent', {
        agentId: message.toAgent
      });
      return;
    }

    const handler = agentHandlers.get(message.type);
    
    if (!handler) {
      logger.warn('No handler for message type', {
        agentId: message.toAgent,
        messageType: message.type
      });
      return;
    }

    try {
      const result = await handler(message);

      // If it's a request, automatically send response
      if (message.type === 'REQUEST' && result !== undefined) {
        await this.reply(message, message.toAgent, result);
      }
    } catch (error) {
      logger.error('Message handler error', {
        messageId: message.id,
        agentId: message.toAgent,
        error: error instanceof Error ? error.message : String(error)
      });

      // If it's a request, send error response
      if (message.type === 'REQUEST') {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timeoutId);
          pending.reject(error instanceof Error ? error : new Error(String(error)));
          this.pendingRequests.delete(message.id);
        }
      }
    }
  }

  /**
   * Get messages for execution
   */
  getMessages(executionId: string): AgentMessage[] {
    return Array.from(this.messages.values())
      .filter(msg => msg.executionId === executionId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get messages between two agents
   */
  getConversation(
    executionId: string,
    agent1: string,
    agent2: string
  ): AgentMessage[] {
    return Array.from(this.messages.values())
      .filter(msg => 
        msg.executionId === executionId &&
        ((msg.fromAgent === agent1 && msg.toAgent === agent2) ||
         (msg.fromAgent === agent2 && msg.toAgent === agent1))
      )
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Clear messages for execution
   */
  clear(executionId: string): void {
    for (const [messageId, message] of this.messages.entries()) {
      if (message.executionId === executionId) {
        this.messages.delete(messageId);
      }
    }

    logger.info('Messages cleared', { executionId });
  }

  /**
   * Cleanup expired messages
   */
  cleanupExpired(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [messageId, message] of this.messages.entries()) {
      if (message.expiresAt && message.expiresAt < now) {
        this.messages.delete(messageId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up expired messages', { count: cleanedCount });
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalMessages: number;
    totalHandlers: number;
    pendingRequests: number;
    messagesByType: Record<MessageType, number>;
  } {
    const messagesByType: Record<MessageType, number> = {
      REQUEST: 0,
      RESPONSE: 0,
      NOTIFICATION: 0,
      QUERY: 0,
      DATA_SHARE: 0
    };

    for (const message of this.messages.values()) {
      messagesByType[message.type]++;
    }

    let totalHandlers = 0;
    for (const handlers of this.handlers.values()) {
      totalHandlers += handlers.size;
    }

    return {
      totalMessages: this.messages.size,
      totalHandlers,
      pendingRequests: this.pendingRequests.size,
      messagesByType
    };
  }
}

// Singleton instance
export const agentMessenger = new AgentMessenger();

// Cleanup expired messages every 5 minutes
setInterval(() => {
  agentMessenger.cleanupExpired();
}, 5 * 60 * 1000);
