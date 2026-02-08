/**
 * Human-in-the-Loop Gates
 * Serverless placeholder
 */

export interface ApprovalRequest {
  id: string;
  executionId: string;
  type: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export const hitlGate = {
  getPendingApprovals: async (executionId: string): Promise<ApprovalRequest[]> => {
    return [];
  },
  
  approveRequest: async (approvalId: string): Promise<{ success: boolean }> => {
    return { success: true };
  },
  
  rejectRequest: async (approvalId: string): Promise<{ success: boolean }> => {
    return { success: true };
  },
};
