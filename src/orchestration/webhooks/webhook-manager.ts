/**
 * Webhook Manager
 * Manages webhooks and triggers
 */

import type { Webhook, WebhookExecution } from '../../types/webhook.types.js';
import { logger } from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../db/client.js';
import { masterOrchestrator } from '../master-orchestrator.js';

export type TriggerType = 
  | 'SCHEDULE'
  | 'FILE_UPLOAD'
  | 'METRIC_THRESHOLD'
  | 'CALENDAR_EVENT'
  | 'EMAIL_RECEIVED'
  | 'MANUAL';

export interface Trigger {
  type: TriggerType;
  config: any;
}

export interface WebhookAction {
  type: 'EXECUTION' | 'EMAIL' | 'NOTIFICATION';
  config: any;
}

export class WebhookManager {
  private webhooks: Map<string, Webhook>;
  private cronJobs: Map<string, NodeJS.Timeout>;

  constructor() {
    this.webhooks = new Map();
    this.cronJobs = new Map();
  }

  /**
   * Register webhook
   */
  async register(
    userId: string,
    name: string,
    trigger: Trigger,
    action: WebhookAction,
    workspaceId?: string
  ): Promise<string> {
    const webhook: Webhook = {
      id: uuidv4(),
      userId,
      workspaceId,
      name,
      triggerType: trigger.type,
      triggerConfig: trigger.config,
      actionConfig: action.config,
      enabled: true,
      createdAt: new Date()
    };

    // Save to database
    try {
      const { error } = await supabase
        .from('webhooks')
        .insert({
          id: webhook.id,
          user_id: webhook.userId,
          workspace_id: webhook.workspaceId,
          name: webhook.name,
          trigger_type: webhook.triggerType,
          trigger_config: JSON.stringify(webhook.triggerConfig),
          action_config: JSON.stringify(webhook.actionConfig),
          enabled: webhook.enabled,
          created_at: webhook.createdAt.toISOString()
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error('Failed to save webhook', {
        webhookId: webhook.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }

    this.webhooks.set(webhook.id, webhook);

    // Setup trigger
    await this.setupTrigger(webhook);

    logger.info('Webhook registered', {
      webhookId: webhook.id,
      name: webhook.name,
      triggerType: webhook.triggerType
    });

    return webhook.id;
  }

  /**
   * Setup trigger
   */
  private async setupTrigger(webhook: Webhook): Promise<void> {
    switch (webhook.triggerType) {
      case 'SCHEDULE':
        this.setupScheduleTrigger(webhook);
        break;

      case 'FILE_UPLOAD':
        // TODO: Setup file watcher
        break;

      case 'METRIC_THRESHOLD':
        // TODO: Setup metric monitor
        break;

      case 'CALENDAR_EVENT':
        // TODO: Setup calendar watcher
        break;

      case 'EMAIL_RECEIVED':
        // TODO: Setup email watcher
        break;

      case 'MANUAL':
        // No setup needed
        break;
    }
  }

  /**
   * Setup schedule trigger (cron-like)
   */
  private setupScheduleTrigger(webhook: Webhook): void {
    const config = webhook.triggerConfig;
    
    if (!config.schedule) {
      logger.warn('Schedule trigger missing schedule config', {
        webhookId: webhook.id
      });
      return;
    }

    // Parse schedule (e.g., "every day at 9:00")
    const intervalMs = this.parseSchedule(config.schedule);

    if (!intervalMs) {
      logger.warn('Invalid schedule format', {
        webhookId: webhook.id,
        schedule: config.schedule
      });
      return;
    }

    // Create recurring job
    const job = setInterval(async () => {
      await this.executeWebhook(webhook.id, {});
    }, intervalMs);

    this.cronJobs.set(webhook.id, job);

    logger.info('Schedule trigger setup', {
      webhookId: webhook.id,
      schedule: config.schedule,
      intervalMs
    });
  }

  /**
   * Parse schedule string to milliseconds
   */
  private parseSchedule(schedule: string): number | null {
    const lowerSchedule = schedule.toLowerCase();

    // Every X minutes
    const minutesMatch = lowerSchedule.match(/every (\d+) minutes?/);
    if (minutesMatch) {
      return parseInt(minutesMatch[1]) * 60 * 1000;
    }

    // Every X hours
    const hoursMatch = lowerSchedule.match(/every (\d+) hours?/);
    if (hoursMatch) {
      return parseInt(hoursMatch[1]) * 60 * 60 * 1000;
    }

    // Every day at HH:MM
    if (lowerSchedule.includes('every day')) {
      return 24 * 60 * 60 * 1000; // Daily
    }

    // Every week
    if (lowerSchedule.includes('every week')) {
      return 7 * 24 * 60 * 60 * 1000;
    }

    return null;
  }

  /**
   * Execute webhook
   */
  async executeWebhook(
    webhookId: string,
    payload: any
  ): Promise<string> {
    const webhook = this.webhooks.get(webhookId);

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    if (!webhook.enabled) {
      logger.info('Webhook disabled, skipping execution', { webhookId });
      return '';
    }

    const execution: WebhookExecution = {
      id: uuidv4(),
      webhookId,
      triggeredAt: new Date(),
      triggerPayload: payload,
      success: false
    };

    logger.info('Executing webhook', {
      webhookId,
      name: webhook.name
    });

    const startTime = Date.now();

    try {
      // Execute action
      let executionId: string = '';

      switch (webhook.actionConfig.type) {
        case 'EXECUTION':
          executionId = await this.executeOrchestration(webhook, payload);
          break;

        case 'EMAIL':
          await this.sendEmail(webhook, payload);
          break;

        case 'NOTIFICATION':
          await this.sendNotification(webhook, payload);
          break;

        default:
          throw new Error(`Unknown action type: ${webhook.actionConfig.type}`);
      }

      execution.success = true;
      execution.executionId = executionId;
    } catch (error) {
      execution.success = false;
      execution.error = error instanceof Error ? error.message : String(error);

      logger.error('Webhook execution failed', {
        webhookId,
        error: execution.error
      });
    }

    execution.durationMs = Date.now() - startTime;

    // Save execution record
    try {
      await supabase
        .from('webhook_executions')
        .insert({
          id: execution.id,
          webhook_id: execution.webhookId,
          triggered_at: execution.triggeredAt.toISOString(),
          trigger_payload: JSON.stringify(execution.triggerPayload),
          execution_id: execution.executionId,
          success: execution.success,
          error: execution.error,
          duration_ms: execution.durationMs
        });
    } catch (error) {
      logger.error('Failed to save webhook execution', {
        executionId: execution.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return execution.executionId || '';
  }

  /**
   * Execute orchestration
   */
  private async executeOrchestration(
    webhook: Webhook,
    payload: any
  ): Promise<string> {
    const request = webhook.actionConfig.request || 'Execute webhook action';

    const execution = await masterOrchestrator.start(request, webhook.userId);

    return execution.id;
  }

  /**
   * Send email
   */
  private async sendEmail(webhook: Webhook, payload: any): Promise<void> {
    // TODO: Implement email sending
    logger.info('Sending webhook email', { webhookId: webhook.id });
  }

  /**
   * Send notification
   */
  private async sendNotification(webhook: Webhook, payload: any): Promise<void> {
    // TODO: Implement notification
    logger.info('Sending webhook notification', { webhookId: webhook.id });
  }

  /**
   * Disable webhook
   */
  async disable(webhookId: string): Promise<void> {
    const webhook = this.webhooks.get(webhookId);

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    webhook.enabled = false;

    // Stop cron job
    const job = this.cronJobs.get(webhookId);
    if (job) {
      clearInterval(job);
      this.cronJobs.delete(webhookId);
    }

    // Update database
    try {
      await supabase
        .from('webhooks')
        .update({ enabled: false })
        .eq('id', webhookId);
    } catch (error) {
      logger.error('Failed to disable webhook', {
        webhookId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    logger.info('Webhook disabled', { webhookId });
  }

  /**
   * Enable webhook
   */
  async enable(webhookId: string): Promise<void> {
    const webhook = this.webhooks.get(webhookId);

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    webhook.enabled = true;

    // Setup trigger
    await this.setupTrigger(webhook);

    // Update database
    try {
      await supabase
        .from('webhooks')
        .update({ enabled: true })
        .eq('id', webhookId);
    } catch (error) {
      logger.error('Failed to enable webhook', {
        webhookId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    logger.info('Webhook enabled', { webhookId });
  }

  /**
   * Delete webhook
   */
  async delete(webhookId: string): Promise<void> {
    await this.disable(webhookId);

    this.webhooks.delete(webhookId);

    // Delete from database
    try {
      await supabase
        .from('webhooks')
        .delete()
        .eq('id', webhookId);
    } catch (error) {
      logger.error('Failed to delete webhook', {
        webhookId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    logger.info('Webhook deleted', { webhookId });
  }

  /**
   * Get webhooks for user
   */
  async getUserWebhooks(userId: string): Promise<Webhook[]> {
    return Array.from(this.webhooks.values())
      .filter(w => w.userId === userId);
  }

  /**
   * Load webhooks from database
   */
  async loadWebhooks(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('webhooks')
        .select('*')
        .eq('enabled', true);

      if (error) {
        throw error;
      }

      for (const row of data || []) {
        const webhook: Webhook = {
          id: row.id,
          userId: row.user_id,
          workspaceId: row.workspace_id,
          name: row.name,
          triggerType: row.trigger_type,
          triggerConfig: JSON.parse(row.trigger_config),
          actionConfig: JSON.parse(row.action_config),
          enabled: row.enabled,
          createdAt: new Date(row.created_at)
        };

        this.webhooks.set(webhook.id, webhook);
        await this.setupTrigger(webhook);
      }

      logger.info('Webhooks loaded', { count: this.webhooks.size });
    } catch (error) {
      logger.error('Failed to load webhooks', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const webhookManager = new WebhookManager();

// Load webhooks on startup
webhookManager.loadWebhooks();
