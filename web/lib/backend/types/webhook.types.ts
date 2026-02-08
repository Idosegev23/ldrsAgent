/**
 * Webhook Types
 */

export interface Webhook {
  id: string;
  userId: string;
  workspaceId?: string;
  name: string;
  triggerType: string;
  triggerConfig: any;
  actionConfig: any;
  enabled: boolean;
  createdAt: Date;
}

export interface WebhookExecution {
  id: string;
  webhookId: string;
  triggeredAt: Date;
  triggerPayload: any;
  executionId?: string;
  success: boolean;
  error?: string;
  durationMs?: number;
}
