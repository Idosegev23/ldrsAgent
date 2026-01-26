/**
 * ExecutionTree Component
 * Displays execution steps in a tree structure
 */

'use client';

import React from 'react';
import type { Execution, ExecutionStep } from '@backend/types/orchestration.types';

interface ExecutionTreeProps {
  execution: Execution;
}

export function ExecutionTree({ execution }: ExecutionTreeProps) {
  if (!execution.plan) {
    return (
      <div className="p-4 text-gray-500">
        אין תוכנית זמינה
      </div>
    );
  }

  return (
    <div className="execution-tree p-4">
      <h3 className="text-lg font-bold mb-4">צעדי ביצוע</h3>
      
      <div className="space-y-2">
        {execution.plan.steps.map((step, index) => (
          <StepNode
            key={step.id}
            step={step}
            isActive={index === execution.currentStep}
          />
        ))}
      </div>

      <div className="mt-4 text-sm text-gray-600">
        התקדמות: {execution.currentStep} / {execution.totalSteps}
      </div>
    </div>
  );
}

interface StepNodeProps {
  step: ExecutionStep;
  isActive: boolean;
}

function StepNode({ step, isActive }: StepNodeProps) {
  const statusColors = {
    PENDING: 'bg-gray-200 text-gray-600',
    RUNNING: 'bg-blue-500 text-white animate-pulse',
    COMPLETED: 'bg-green-500 text-white',
    FAILED: 'bg-red-500 text-white',
    SKIPPED: 'bg-yellow-500 text-white'
  };

  const statusIcons = {
    PENDING: '⏳',
    RUNNING: '▶️',
    COMPLETED: '✓',
    FAILED: '✗',
    SKIPPED: '⊘'
  };

  return (
    <div
      className={`step-node p-3 rounded-lg border-2 ${
        isActive ? 'border-blue-500 shadow-lg' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded text-sm ${statusColors[step.status]}`}>
            {statusIcons[step.status]} {step.status}
          </span>
          
          <div>
            <div className="font-semibold">
              {step.stepNumber}. {step.agentName}
            </div>
            <div className="text-sm text-gray-600">
              {step.description}
            </div>
          </div>
        </div>

        {step.durationMs && (
          <div className="text-xs text-gray-500">
            {(step.durationMs / 1000).toFixed(1)}s
          </div>
        )}
      </div>

      {step.error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          {step.error}
        </div>
      )}

      {step.tokensUsed && (
        <div className="mt-2 text-xs text-gray-500">
          Tokens: {step.tokensUsed.toLocaleString()}
        </div>
      )}
    </div>
  );
}
