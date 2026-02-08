/**
 * MetricsDashboard Component
 * Display execution metrics
 */

'use client';

import React from 'react';
import type { Execution } from '@/lib/backend/types/orchestration.types';

interface MetricsDashboardProps {
  execution: Execution;
}

export function MetricsDashboard({ execution }: MetricsDashboardProps) {
  const durationMs = execution.completedAt
    ? new Date(execution.completedAt).getTime() - new Date(execution.createdAt).getTime()
    : Date.now() - new Date(execution.createdAt).getTime();

  const durationSeconds = (durationMs / 1000).toFixed(1);

  const totalTokens = execution.result?.totalTokensUsed || 0;
  const estimatedTokens = execution.plan?.estimatedTokens || 0;

  const successRate = execution.plan?.steps
    ? (execution.plan.steps.filter(s => s.status === 'COMPLETED').length / 
       execution.plan.steps.length * 100).toFixed(0)
    : 0;

  return (
    <div className="metrics-dashboard p-4 bg-gray-50 rounded-lg">
      <h3 className="text-lg font-bold mb-4">מטריקות</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <MetricCard
          label="משך זמן"
          value={`${durationSeconds}s`}
          subtext={execution.plan?.estimatedDuration 
            ? `מתוך ~${(execution.plan.estimatedDuration / 1000).toFixed(0)}s`
            : undefined
          }
        />

        <MetricCard
          label="Tokens"
          value={totalTokens.toLocaleString()}
          subtext={estimatedTokens 
            ? `מתוך ~${estimatedTokens.toLocaleString()}`
            : undefined
          }
        />

        <MetricCard
          label="צעדים"
          value={`${execution.currentStep} / ${execution.totalSteps}`}
          subtext={`${successRate}% הושלמו`}
        />

        <MetricCard
          label="סטטוס"
          value={execution.status}
          className={getStatusColor(execution.status)}
        />
      </div>

      {execution.result && (
        <div className="mt-4 pt-4 border-t">
          <div className="text-sm text-gray-600">
            <strong>זמן כולל:</strong> {(execution.result.totalDurationMs / 1000).toFixed(2)}s
          </div>
          <div className="text-sm text-gray-600">
            <strong>Tokens כולל:</strong> {execution.result.totalTokensUsed.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  className?: string;
}

function MetricCard({ label, value, subtext, className }: MetricCardProps) {
  return (
    <div className="metric-card bg-white p-3 rounded border">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${className || ''}`}>
        {value}
      </div>
      {subtext && (
        <div className="text-xs text-gray-500 mt-1">
          {subtext}
        </div>
      )}
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'COMPLETED': return 'text-green-600';
    case 'FAILED': return 'text-red-600';
    case 'RUNNING': return 'text-blue-600';
    case 'PAUSED': return 'text-yellow-600';
    case 'CANCELLED': return 'text-gray-600';
    default: return 'text-gray-600';
  }
}
