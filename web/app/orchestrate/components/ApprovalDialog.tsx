/**
 * ApprovalDialog Component
 * Display pending approvals
 */

'use client';

import React from 'react';
import type { ApprovalRequest } from '@/lib/backend/types/orchestration.types';

interface ApprovalDialogProps {
  approvals: ApprovalRequest[];
  onApprove: (approvalId: string) => Promise<void>;
  onReject: (approvalId: string) => Promise<void>;
}

export function ApprovalDialog({
  approvals,
  onApprove,
  onReject
}: ApprovalDialogProps) {
  const [loading, setLoading] = React.useState<string | null>(null);

  if (approvals.length === 0) {
    return null;
  }

  const handleAction = async (
    approvalId: string,
    action: 'approve' | 'reject',
    fn: (id: string) => Promise<void>
  ) => {
    setLoading(approvalId);
    try {
      await fn(approvalId);
    } catch (error) {
      console.error('Approval action failed:', error);
      alert('הפעולה נכשלה: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="approval-dialog fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">
            דרוש אישור
          </h2>

          <div className="space-y-4">
            {approvals.map(approval => (
              <div
                key={approval.id}
                className="border rounded-lg p-4 bg-yellow-50 border-yellow-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-sm text-gray-500 mb-1">
                      {approval.type}
                    </div>
                    <h3 className="font-semibold text-lg">
                      {approval.action.description}
                    </h3>
                  </div>
                  
                  {approval.estimatedImpact && (
                    <span className={`px-2 py-1 rounded text-xs ${
                      approval.estimatedImpact.riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                      approval.estimatedImpact.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      סיכון: {approval.estimatedImpact.riskLevel}
                    </span>
                  )}
                </div>

                <div className="mb-3 text-sm text-gray-700">
                  <strong>סיבה:</strong> {approval.reason}
                </div>

                {approval.estimatedImpact && (
                  <div className="mb-3 text-sm text-gray-700">
                    <strong>השפעה:</strong> {approval.estimatedImpact.description}
                  </div>
                )}

                <div className="mb-3 p-3 bg-white rounded border">
                  <strong className="text-sm">פרמטרים:</strong>
                  <pre className="mt-2 text-xs overflow-x-auto" dir="ltr">
                    {JSON.stringify(approval.action.parameters, null, 2)}
                  </pre>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleAction(approval.id, 'reject', onReject)}
                    disabled={loading !== null}
                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading === approval.id ? '⏳ מעבד...' : '✗ דחה'}
                  </button>
                  
                  <button
                    onClick={() => handleAction(approval.id, 'approve', onApprove)}
                    disabled={loading !== null}
                    className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading === approval.id ? '⏳ מעבד...' : '✓ אשר'}
                  </button>
                </div>

                {approval.action.reversible && (
                  <div className="mt-2 text-xs text-gray-500">
                    ℹ️ ניתן לבטל פעולה זו מאוחר יותר
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
