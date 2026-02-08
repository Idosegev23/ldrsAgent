/**
 * ContextViewer Component
 * Display shared context data
 */

'use client';

import React, { useState } from 'react';
import type { SharedContext } from '@/lib/backend/types/orchestration.types';

interface ContextViewerProps {
  context: SharedContext;
}

export function ContextViewer({ context }: ContextViewerProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) => {
    const newExpanded = new Set(expandedKeys);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedKeys(newExpanded);
  };

  const contextKeys = Object.keys(context.data);

  if (contextKeys.length === 0) {
    return (
      <div className="p-4 text-gray-500">
        אין נתוני הקשר עדיין
      </div>
    );
  }

  return (
    <div className="context-viewer p-4">
      <h3 className="text-lg font-bold mb-4">נתוני הקשר</h3>
      
      <div className="space-y-2">
        {contextKeys.map(key => {
          const contextValue = context.data[key];
          const isExpanded = expandedKeys.has(key);

          return (
            <div key={key} className="border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleExpand(key)}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    {isExpanded ? '▼' : '▶'}
                  </button>
                  <span className="font-semibold">{key}</span>
                </div>
                
                <div className="text-xs text-gray-500">
                  {contextValue.createdBy}
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                  <div className="mb-2 text-gray-600">
                    <strong>נוצר על ידי:</strong> {contextValue.createdBy}
                  </div>
                  <div className="mb-2 text-gray-600">
                    <strong>זמן:</strong> {new Date(contextValue.createdAt).toLocaleString('he-IL')}
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <strong className="text-gray-700">ערך:</strong>
                    <pre className="mt-2 bg-white p-2 rounded overflow-x-auto text-xs" dir="ltr">
                      {JSON.stringify(contextValue.value, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
