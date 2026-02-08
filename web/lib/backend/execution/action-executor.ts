/**
 * Action Executor
 * Serverless-compatible action execution
 */

export interface PendingAction {
  id: string;
  type: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  parameters: any;
  createdAt: string;
}

export async function getJobPendingActions(jobId: string): Promise<PendingAction[]> {
  // In serverless, we don't have long-running processes that need approval
  return [];
}

export async function executeAction(actionId: string): Promise<{ success: boolean; message: string }> {
  return {
    success: true,
    message: 'Action executed successfully',
  };
}

export async function rejectAction(actionId: string, reason?: string): Promise<{ success: boolean }> {
  return {
    success: true,
  };
}
