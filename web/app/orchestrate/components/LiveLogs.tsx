/**
 * LiveLogs Component
 * Real-time log display
 */

'use client';

import React, { useEffect, useRef } from 'react';
import type { LogEvent } from '@backend/types/orchestration.types';

interface LiveLogsProps {
  logs: LogEvent[];
  autoScroll?: boolean;
}

export function LiveLogs({ logs, autoScroll = true }: LiveLogsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const levelColors = {
    DEBUG: 'text-gray-500',
    INFO: 'text-blue-600',
    WARN: 'text-yellow-600',
    ERROR: 'text-red-600'
  };

  const levelIcons = {
    DEBUG: '🔍',
    INFO: 'ℹ️',
    WARN: '⚠️',
    ERROR: '❌'
  };

  return (
    <div
      ref={containerRef}
      className="live-logs h-96 overflow-y-auto bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm"
      dir="ltr"
    >
      {logs.length === 0 ? (
        <div className="text-gray-500 text-center">
          אין לוגים עדיין...
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map((log, index) => (
            <div
              key={index}
              className={`log-entry ${levelColors[log.level]}`}
            >
              <span className="text-gray-500">
                [{new Date().toLocaleTimeString('he-IL')}]
              </span>
              {' '}
              <span className="inline-block w-6">
                {levelIcons[log.level]}
              </span>
              {' '}
              <span className="text-gray-400">
                [{log.source}]
              </span>
              {' '}
              <span className={levelColors[log.level]}>
                {log.message}
              </span>
              
              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <div className="ml-12 text-gray-600 text-xs">
                  {JSON.stringify(log.metadata, null, 2)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
