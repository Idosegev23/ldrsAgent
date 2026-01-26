'use client';

import { useState } from 'react';

interface PendingAction {
  id: string;
  type: 'SEND_EMAIL' | 'CREATE_TASK' | 'CREATE_EVENT';
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  preview: {
    title: string;
    description: string;
    recipient?: string;
    recipientEmail?: string;
  };
  parameters: {
    to?: string[];
    subject?: string;
    body?: string;
    [key: string]: any;
  };
}

interface Message {
  id: string;
  type: 'user' | 'agent';
  content: string;
  agentId?: string;
  agentName?: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'error';
  pendingAction?: PendingAction;
  jobId?: string;
}

interface ChatMessageProps {
  message: Message;
  onExecuteAction?: (actionId: string, jobId: string) => Promise<void>;
}

export function ChatMessage({ message, onExecuteAction }: ChatMessageProps) {
  const isUser = message.type === 'user';
  const [actionExecuting, setActionExecuting] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);

  const handleExecuteAction = async () => {
    if (!message.pendingAction || !message.jobId || !onExecuteAction) return;
    
    setActionExecuting(true);
    try {
      await onExecuteAction(message.pendingAction.id, message.jobId);
      setActionResult('הפעולה בוצעה בהצלחה!');
    } catch (error) {
      setActionResult(`שגיאה: ${(error as Error).message}`);
    } finally {
      setActionExecuting(false);
    }
  };

  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'} animate-fadeIn`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-white/10 text-white'
            : 'bg-gradient-to-r from-primary-600 to-primary-700 text-white'
        } ${message.status === 'error' ? 'border border-red-500' : ''}`}
      >
        {/* Agent badge */}
        {!isUser && message.agentName && (
          <div className="text-xs text-white/60 mb-1 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            {message.agentName}
          </div>
        )}

        {/* Message content */}
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {message.status === 'sending' ? (
            <div className="flex items-center gap-2">
              <span className="animate-pulse">{message.content}</span>
              <span className="flex gap-1">
                <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </span>
            </div>
          ) : (
            formatContent(message.content)
          )}
        </div>

        {/* Pending Action Button */}
        {message.pendingAction && message.pendingAction.status === 'pending' && !actionResult && (
          <div className="mt-4 pt-4 border-t border-white/20">
            <div className="bg-white/10 rounded-lg p-3 mb-3">
              <div className="text-xs text-white/60 mb-1">{message.pendingAction.preview.title}</div>
              <div className="text-sm font-medium mb-1">{message.pendingAction.preview.description}</div>
              {message.pendingAction.preview.recipientEmail && (
                <div className="text-xs text-white/80">
                  📧 {message.pendingAction.preview.recipient} ({message.pendingAction.preview.recipientEmail})
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleExecuteAction}
                disabled={actionExecuting}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                {actionExecuting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>שולח...</span>
                  </>
                ) : (
                  <>
                    <span>✓</span>
                    <span>אשר ושלח</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setActionResult('הפעולה בוטלה')}
                disabled={actionExecuting}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        )}

        {/* Action Result */}
        {actionResult && (
          <div className={`mt-3 p-2 rounded-lg text-xs ${
            actionResult.includes('בהצלחה') 
              ? 'bg-green-500/20 text-green-100' 
              : actionResult.includes('בוטלה')
              ? 'bg-gray-500/20 text-gray-100'
              : 'bg-red-500/20 text-red-100'
          }`}>
            {actionResult}
          </div>
        )}

        {/* Timestamp */}
        <div className={`text-xs mt-2 ${isUser ? 'text-white/40' : 'text-white/60'}`}>
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
}

function formatContent(content: string): React.ReactNode {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[] = [];
  
  const processInlineFormatting = (text: string) => {
    // Bold: **text** or __text__
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
    text = text.replace(/__(.+?)__/g, '<strong class="font-bold text-white">$1</strong>');
    
    // Italic: *text* or _text_ (but not ** or __)
    text = text.replace(/(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g, '<em class="italic text-white/90">$1</em>');
    text = text.replace(/(?<!_)_(?!_)(.+?)_(?!_)/g, '<em class="italic text-white/90">$1</em>');
    
    // Inline code: `code`
    text = text.replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono text-purple-300">$1</code>');
    
    // Links: [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">$1</a>');
    
    return text;
  };

  const flushTable = (i: number) => {
    if (tableRows.length > 0) {
      const [headerRow, separatorRow, ...bodyRows] = tableRows;
      const headers = headerRow.split('|').map(h => h.trim()).filter(h => h);
      
      elements.push(
        <div key={`table-${i}`} className="overflow-x-auto my-4">
          <table className="min-w-full border-collapse border border-white/20 rounded-lg">
            <thead className="bg-white/5">
              <tr>
                {headers.map((header, idx) => (
                  <th key={idx} className="border border-white/20 px-4 py-2 text-left font-bold text-sm">
                    <span dangerouslySetInnerHTML={{ __html: processInlineFormatting(header) }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rowIdx) => {
                const cells = row.split('|').map(c => c.trim()).filter(c => c);
                return (
                  <tr key={rowIdx} className="hover:bg-white/5 transition-colors">
                    {cells.map((cell, cellIdx) => (
                      <td key={cellIdx} className="border border-white/20 px-4 py-2 text-sm">
                        <span dangerouslySetInnerHTML={{ __html: processInlineFormatting(cell) }} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  };

  lines.forEach((line, i) => {
    // Table detection
    if (line.includes('|') && (line.match(/\|/g) || []).length >= 2) {
      tableRows.push(line);
      inTable = true;
      return;
    } else if (inTable) {
      flushTable(i);
    }

    // Headers
    if (line.startsWith('#### ')) {
      elements.push(<h4 key={i} className="font-bold text-base mt-2 mb-1 text-white">{line.slice(5)}</h4>);
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="font-bold text-lg mt-3 mb-1 text-white">{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="font-bold text-xl mt-4 mb-2 text-white">{line.slice(3)}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="font-bold text-2xl mt-4 mb-2 text-white">{line.slice(2)}</h1>);
    }
    // Blockquote
    else if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={i} className="border-l-4 border-purple-500 pl-4 my-2 italic text-white/80">
          <span dangerouslySetInnerHTML={{ __html: processInlineFormatting(line.slice(2)) }} />
        </blockquote>
      );
    }
    // Numbered lists
    else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.+)$/);
      if (match) {
        elements.push(
          <div key={i} className="flex items-start gap-3 my-1">
            <span className="text-purple-400 font-mono text-sm min-w-[1.5rem]">{match[1]}.</span>
            <span dangerouslySetInnerHTML={{ __html: processInlineFormatting(match[2]) }} />
          </div>
        );
      }
    }
    // Bullet lists
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} className="flex items-start gap-2 my-1">
          <span className="text-purple-400 text-lg leading-tight">•</span>
          <span dangerouslySetInnerHTML={{ __html: processInlineFormatting(line.slice(2)) }} />
        </div>
      );
    }
    // Horizontal rule
    else if (line === '---' || line === '***' || line === '___') {
      elements.push(<hr key={i} className="border-white/20 my-4" />);
    }
    // Regular line
    else if (line.trim()) {
      elements.push(
        <p key={i} className="my-1 leading-relaxed">
          <span dangerouslySetInnerHTML={{ __html: processInlineFormatting(line) }} />
        </p>
      );
    }
    // Empty line
    else {
      elements.push(<br key={i} />);
    }
  });

  // Flush any remaining table
  if (inTable) {
    flushTable(lines.length);
  }

  return <div className="markdown-content">{elements}</div>;
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
