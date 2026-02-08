/**
 * ActionControls Component
 * Control buttons for execution
 */

'use client';

import React from 'react';
import type { Execution } from '@/lib/backend/types/orchestration.types';

interface ActionControlsProps {
  execution: Execution;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onCancel: () => Promise<void>;
}

export function ActionControls({
  execution,
  onPause,
  onResume,
  onCancel
}: ActionControlsProps) {
  const [loading, setLoading] = React.useState<string | null>(null);

  const handleAction = async (action: string, fn: () => Promise<void>) => {
    setLoading(action);
    try {
      await fn();
    } catch (error) {
      console.error('Action failed:', error);
      alert('הפעולה נכשלה: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(null);
    }
  };

  const canPause = execution.status === 'RUNNING';
  const canResume = execution.status === 'PAUSED';
  const canCancel = execution.status === 'RUNNING' || execution.status === 'PAUSED';

  return (
    <div className="action-controls flex gap-3">
      {canPause && (
        <button
          onClick={() => handleAction('pause', onPause)}
          disabled={loading !== null}
          className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === 'pause' ? '⏳ מעבד...' : '⏸ השהה'}
        </button>
      )}

      {canResume && (
        <button
          onClick={() => handleAction('resume', onResume)}
          disabled={loading !== null}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === 'resume' ? '⏳ מעבד...' : '▶ המשך'}
        </button>
      )}

      {canCancel && (
        <button
          onClick={() => handleAction('cancel', onCancel)}
          disabled={loading !== null}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === 'cancel' ? '⏳ מעבד...' : '✖ ביטול'}
        </button>
      )}

      {execution.status === 'COMPLETED' && (
        <div className="px-4 py-2 bg-green-100 text-green-700 rounded">
          ✓ הושלם
        </div>
      )}

      {execution.status === 'FAILED' && (
        <div className="px-4 py-2 bg-red-100 text-red-700 rounded">
          ✗ נכשל
        </div>
      )}

      {execution.status === 'CANCELLED' && (
        <div className="px-4 py-2 bg-gray-100 text-gray-700 rounded">
          ⊘ בוטל
        </div>
      )}
    </div>
  );
}
