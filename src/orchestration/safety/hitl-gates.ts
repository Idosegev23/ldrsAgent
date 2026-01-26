/**
 * Human-in-the-Loop Gates
 * Critical decision points requiring user approval
 */

import type {
  ApprovalRequest,
  ApprovalAction,
  EstimatedImpact
} from '../../types/orchestration.types.js';
import { logger } from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../db/client.js';

export class HITLGate {
  private pendingApprovals: Map<string, ApprovalRequest>;

  constructor() {
    this.pendingApprovals = new Map();
  }

  /**
   * Check if user approval is needed
   */
  shouldAskUser(action: ApprovalAction): boolean {
    // Critical actions always require approval
    if (this.isCritical(action)) {
      return true;
    }

    // Check if action is ambiguous
    // TODO: Implement ambiguity detection

    return false;
  }

  /**
   * Check if action is critical
   */
  isCritical(action: ApprovalAction): boolean {
    const criticalTypes = [
      'DELETE',
      'BULK_SEND',
      'PAYMENT',
      'PUBLISH',
      'DEPLOY'
    ];

    return criticalTypes.some(type => 
      action.type.toUpperCase().includes(type)
    );
  }

  /**
   * Check if context is ambiguous
   */
  isAmbiguous(context: any): boolean {
    // TODO: Implement ambiguity detection
    // Example: Multiple contacts with same name
    return false;
  }

  /**
   * Estimate action cost
   */
  estimateCost(action: ApprovalAction): number {
    // TODO: Implement cost estimation
    return 0;
  }

  /**
   * Create approval request
   */
  async createApprovalRequest(
    executionId: string,
    stepId: string,
    action: ApprovalAction,
    reason: string,
    estimatedImpact?: EstimatedImpact
  ): Promise<ApprovalRequest> {
    const approval: ApprovalRequest = {
      id: uuidv4(),
      executionId,
      stepId,
      type: this.isCritical(action) ? 'CRITICAL_ACTION' : 'MANUAL_REVIEW',
      action,
      reason,
      estimatedImpact,
      status: 'PENDING',
      createdAt: new Date()
    };

    // Save to database
    try {
      const { error } = await supabase
        .from('pending_approvals')
        .insert({
          id: approval.id,
          execution_id: approval.executionId,
          action_type: approval.type,
          action_data: JSON.stringify(approval.action),
          reason: approval.reason,
          estimated_impact: approval.estimatedImpact ? 
            JSON.stringify(approval.estimatedImpact) : null,
          status: approval.status,
          created_at: approval.createdAt.toISOString()
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error('Failed to save approval request', {
        approvalId: approval.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    this.pendingApprovals.set(approval.id, approval);

    logger.info('Approval request created', {
      approvalId: approval.id,
      executionId,
      type: approval.type
    });

    return approval;
  }

  /**
   * Wait for approval
   */
  async waitForApproval(
    approvalId: string,
    timeoutMs: number = 300000 // 5 minutes
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const approval = this.pendingApprovals.get(approvalId);
      
      if (!approval) {
        throw new Error('Approval not found');
      }

      if (approval.status === 'APPROVED') {
        return true;
      }

      if (approval.status === 'REJECTED') {
        return false;
      }

      // Check database for updates
      try {
        const { data, error } = await supabase
          .from('pending_approvals')
          .select('status, resolved_at, resolved_by')
          .eq('id', approvalId)
          .single();

        if (!error && data && data.status !== 'PENDING') {
          approval.status = data.status;
          approval.resolvedAt = data.resolved_at ? new Date(data.resolved_at) : undefined;
          approval.resolvedBy = data.resolved_by;

          this.pendingApprovals.set(approvalId, approval);

          return approval.status === 'APPROVED';
        }
      } catch (error) {
        logger.error('Failed to check approval status', {
          approvalId,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('Approval timeout');
  }

  /**
   * Approve action
   */
  async approve(
    approvalId: string,
    resolvedBy: string
  ): Promise<void> {
    const approval = this.pendingApprovals.get(approvalId);
    
    if (!approval) {
      throw new Error('Approval not found');
    }

    approval.status = 'APPROVED';
    approval.resolvedAt = new Date();
    approval.resolvedBy = resolvedBy;

    // Update database
    try {
      const { error } = await supabase
        .from('pending_approvals')
        .update({
          status: 'APPROVED',
          resolved_at: approval.resolvedAt.toISOString(),
          resolved_by: resolvedBy
        })
        .eq('id', approvalId);

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error('Failed to update approval', {
        approvalId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    logger.info('Approval granted', {
      approvalId,
      resolvedBy
    });
  }

  /**
   * Reject action
   */
  async reject(
    approvalId: string,
    resolvedBy: string
  ): Promise<void> {
    const approval = this.pendingApprovals.get(approvalId);
    
    if (!approval) {
      throw new Error('Approval not found');
    }

    approval.status = 'REJECTED';
    approval.resolvedAt = new Date();
    approval.resolvedBy = resolvedBy;

    // Update database
    try {
      const { error } = await supabase
        .from('pending_approvals')
        .update({
          status: 'REJECTED',
          resolved_at: approval.resolvedAt.toISOString(),
          resolved_by: resolvedBy
        })
        .eq('id', approvalId);

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error('Failed to update approval', {
        approvalId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    logger.info('Approval rejected', {
      approvalId,
      resolvedBy
    });
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals(executionId: string): Promise<ApprovalRequest[]> {
    return Array.from(this.pendingApprovals.values())
      .filter(approval => 
        approval.executionId === executionId && 
        approval.status === 'PENDING'
      );
  }
}

export const hitlGate = new HITLGate();
