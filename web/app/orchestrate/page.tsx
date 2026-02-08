/**
 * Orchestration Dashboard Page
 * Main dashboard for viewing and controlling executions
 */

'use client';

import React, { useState, useEffect } from 'react';
import { ExecutionTree } from './components/ExecutionTree';
import { LiveLogs } from './components/LiveLogs';
import { ContextViewer } from './components/ContextViewer';
import { ActionControls } from './components/ActionControls';
import { MetricsDashboard } from './components/MetricsDashboard';
import { ApprovalDialog } from './components/ApprovalDialog';
import { useExecutionStream } from './hooks/useExecutionStream';
import type { Execution } from '@/lib/backend/types/orchestration.types';
import type { LogEvent } from '@/lib/backend/types/orchestration.types';

export default function OrchestratePage() {
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [execution, setExecution] = useState<Execution | null>(null);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'logs' | 'context' | 'metrics'>('logs');
  const [oauthConnected, setOauthConnected] = useState<boolean | null>(null);
  const [oauthEmail, setOauthEmail] = useState<string>('');

  const stream = useExecutionStream(executionId);

  // Check OAuth status on mount
  useEffect(() => {
    const checkOAuthStatus = async () => {
      try {
        const response = await fetch('/api/auth/google/status');
        const data = await response.json();
        setOauthConnected(data.connected);
        if (data.email) {
          setOauthEmail(data.email);
        }
      } catch (error) {
        console.error('Failed to check OAuth status:', error);
        setOauthConnected(false);
      }
    };
    
    checkOAuthStatus();
  }, []);

  // Connect to Google
  const connectGoogle = async () => {
    try {
      const response = await fetch('/api/auth/google');
      const data = await response.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        alert('נכשל ליצור קישור התחברות');
      }
    } catch (error) {
      console.error('Failed to initiate OAuth:', error);
      alert('נכשל להתחבר ל-Google');
    }
  };

  // Start new execution
  const startExecution = async () => {
    // Check OAuth first
    if (oauthConnected === false) {
      if (confirm('יש להתחבר ל-Google קודם. להתחבר עכשיו?')) {
        await connectGoogle();
      }
      return;
    }

    const request = prompt('הכנס בקשה:');
    if (!request) return;

    try {
      const response = await fetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: request,
          userId: 'demo-user'
        })
      });

      const data = await response.json();
      
      if (data.execution) {
        setExecutionId(data.execution.id);
      }
    } catch (error) {
      console.error('Failed to start execution:', error);
      alert('נכשל להתחיל ביצוע');
    }
  };

  // Fetch execution details
  useEffect(() => {
    if (!executionId) return;

    const fetchExecution = async () => {
      try {
        const response = await fetch(`/api/orchestrate/${executionId}`);
        const data = await response.json();
        
        if (data.execution) {
          setExecution(data.execution);
        }
      } catch (error) {
        console.error('Failed to fetch execution:', error);
      }
    };

    // Fetch immediately
    fetchExecution();

    // Poll every 2 seconds if still running
    const interval = setInterval(() => {
      if (execution?.status === 'RUNNING' || execution?.status === 'PAUSED') {
        fetchExecution();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [executionId, execution?.status]);

  // Process stream events
  useEffect(() => {
    if (!stream.latestEvent) return;

    const event = stream.latestEvent;

    switch (event.type) {
      case 'log':
        setLogs(prev => [...prev, event.data]);
        break;

      case 'approval_required':
        // Fetch pending approvals
        fetchApprovals();
        break;

      case 'complete':
        // Refresh execution
        if (executionId) {
          fetch(`/api/orchestrate/${executionId}`)
            .then(r => r.json())
            .then(data => setExecution(data.execution));
        }
        break;
    }
  }, [stream.latestEvent]);

  const fetchApprovals = async () => {
    if (!executionId) return;

    try {
      const response = await fetch(`/api/orchestrate/${executionId}/approvals`);
      const data = await response.json();
      setPendingApprovals(data.approvals || []);
    } catch (error) {
      console.error('Failed to fetch approvals:', error);
    }
  };

  // Action handlers
  const handlePause = async () => {
    if (!executionId) return;
    await fetch(`/api/orchestrate/${executionId}/pause`, { method: 'POST' });
  };

  const handleResume = async () => {
    if (!executionId) return;
    await fetch(`/api/orchestrate/${executionId}/resume`, { method: 'POST' });
  };

  const handleCancel = async () => {
    if (!executionId) return;
    if (!confirm('האם אתה בטוח שברצונך לבטל?')) return;
    await fetch(`/api/orchestrate/${executionId}/cancel`, { method: 'POST' });
  };

  const handleApprove = async (approvalId: string) => {
    await fetch(`/api/orchestrate/${executionId}/approvals/${approvalId}/approve`, {
      method: 'POST'
    });
    fetchApprovals();
  };

  const handleReject = async (approvalId: string) => {
    await fetch(`/api/orchestrate/${executionId}/approvals/${approvalId}/reject`, {
      method: 'POST'
    });
    fetchApprovals();
  };

  if (!executionId || !execution) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <h1 className="text-3xl font-bold mb-6">
            מנוע AI אוטונומי
          </h1>
          
          {/* OAuth Status */}
          {oauthConnected === null && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800">בודק התחברות...</p>
            </div>
          )}
          
          {oauthConnected === false && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 font-semibold mb-3">
                🔒 יש להתחבר ל-Google
              </p>
              <p className="text-yellow-700 text-sm mb-4">
                כדי להפעיל את המערכת, צריך להתחבר לחשבון Google שלך
                (Drive, Calendar, Gmail)
              </p>
              <button
                onClick={connectGoogle}
                className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-semibold"
              >
                🔑 התחבר ל-Google
              </button>
            </div>
          )}
          
          {oauthConnected === true && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-semibold mb-2">
                ✅ מחובר ל-Google
              </p>
              {oauthEmail && (
                <p className="text-green-700 text-sm">
                  {oauthEmail}
                </p>
              )}
            </div>
          )}
          
          <button
            onClick={startExecution}
            disabled={oauthConnected === false}
            className={`px-6 py-3 text-white rounded-lg text-lg font-semibold ${
              oauthConnected === false
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            🚀 התחל Execution חדש
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">תזמור AI</h1>
              <p className="text-sm text-gray-500">
                Execution ID: {executionId}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className={`px-3 py-1 rounded text-sm font-semibold ${
                execution.status === 'RUNNING' ? 'bg-blue-100 text-blue-700' :
                execution.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                execution.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                execution.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {execution.status}
              </div>

              <button
                onClick={startExecution}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                + חדש
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span>התקדמות</span>
              <span>{execution.currentStep} / {execution.totalSteps}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(execution.currentStep / execution.totalSteps) * 100}%`
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Action controls */}
        <div className="mb-6">
          <ActionControls
            execution={execution}
            onPause={handlePause}
            onResume={handleResume}
            onCancel={handleCancel}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Execution tree */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <ExecutionTree execution={execution} />
            </div>
          </div>

          {/* Right: Tabs (Logs, Context, Metrics) */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              {/* Tabs */}
              <div className="border-b flex">
                <button
                  onClick={() => setActiveTab('logs')}
                  className={`px-6 py-3 font-semibold ${
                    activeTab === 'logs'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  לוגים חיים
                </button>
                <button
                  onClick={() => setActiveTab('context')}
                  className={`px-6 py-3 font-semibold ${
                    activeTab === 'context'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  נתוני הקשר
                </button>
                <button
                  onClick={() => setActiveTab('metrics')}
                  className={`px-6 py-3 font-semibold ${
                    activeTab === 'metrics'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  מטריקות
                </button>
              </div>

              {/* Tab content */}
              <div className="p-4">
                {activeTab === 'logs' && (
                  <LiveLogs logs={logs} />
                )}

                {activeTab === 'context' && execution.plan && (
                  <ContextViewer
                    context={{
                      executionId: execution.id,
                      data: {},
                      createdAt: execution.createdAt,
                      updatedAt: execution.updatedAt
                    }}
                  />
                )}

                {activeTab === 'metrics' && (
                  <MetricsDashboard execution={execution} />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Result section */}
        {execution.result && (
          <div className="mt-6 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">תוצאה</h2>
            
            <div className="prose max-w-none">
              <div className="mb-4 p-4 bg-gray-50 rounded">
                <strong>סיכום:</strong> {execution.result.summary}
              </div>

              {execution.result.output && (
                <div className="whitespace-pre-wrap">
                  {execution.result.output}
                </div>
              )}

              {execution.result.structured && (
                <details className="mt-4">
                  <summary className="cursor-pointer font-semibold">
                    נתונים מובנים
                  </summary>
                  <pre className="mt-2 p-4 bg-gray-900 text-gray-100 rounded overflow-x-auto text-sm" dir="ltr">
                    {JSON.stringify(execution.result.structured, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Approval dialog */}
      {pendingApprovals.length > 0 && (
        <ApprovalDialog
          approvals={pendingApprovals}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      {/* Connection indicator */}
      <div className="fixed bottom-4 right-4">
        <div className={`px-3 py-2 rounded-full shadow-lg text-sm ${
          stream.connected
            ? 'bg-green-500 text-white'
            : 'bg-red-500 text-white'
        }`}>
          {stream.connected ? '🟢 מחובר' : '🔴 מנותק'}
        </div>
      </div>
    </div>
  );
}
