'use client';

/**
 * Dashboard Main Page - Chat Interface
 * Interactive chat with agents + quick stats
 */

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../components/DashboardLayout';
import { ChatInput } from '@/components/ChatInput';
import { ChatMessage } from '@/components/ChatMessage';
import { AgentSelector } from '@/components/AgentSelector';
import { apiGet, apiPost } from '@/lib/api';

interface SystemStats {
  totalAgents: number;
  activeAgents: number;
  executionsToday: number;
  successRate: number;
  healthyIntegrations: number;
  totalIntegrations: number;
}

interface Agent {
  id: string;
  name: string;
  nameHebrew: string;
  domain: string;
  description: string;
  capabilities: string[];
  layer: number;
  executionsToday?: number;
  successRate?: number;
}

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
}

// Domain colors for agent cards
const domainColors: Record<string, string> = {
  proposals: 'from-blue-500 to-cyan-500',
  research: 'from-purple-500 to-pink-500',
  influencers: 'from-orange-500 to-yellow-500',
  media: 'from-green-500 to-emerald-500',
  creative: 'from-pink-500 to-rose-500',
  operations: 'from-indigo-500 to-violet-500',
  sales: 'from-red-500 to-orange-500',
  hr: 'from-teal-500 to-cyan-500',
  finance: 'from-emerald-500 to-green-500',
  executive: 'from-amber-500 to-yellow-500',
  general: 'from-gray-500 to-slate-500',
};

// Quick action prompts for popular agents
const quickActions = [
  {
    icon: '🎨',
    title: 'צור דיזיין Canva',
    prompt: 'צור לי פוסט אינסטגרם חדש ב-Canva',
    agentDomain: 'canva',
  },
  {
    icon: '📊',
    title: 'אסטרטגיית מדיה',
    prompt: 'תבנה לי אסטרטגיית מדיה ללקוח חדש',
    agentDomain: 'media',
  },
  {
    icon: '💡',
    title: 'רעיונות קריאייטיביים',
    prompt: 'תן לי רעיונות יצירתיים לקמפיין',
    agentDomain: 'creative',
  },
  {
    icon: '🔍',
    title: 'מחקר מתחרים',
    prompt: 'עשה מחקר על המתחרים בתחום',
    agentDomain: 'research',
  },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canvaConnected, setCanvaConnected] = useState<boolean | null>(null);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetchInitialData();
    checkCanvaStatus();
    checkGoogleStatus();
  }, []);

  const checkCanvaStatus = async () => {
    try {
      const response = await apiGet<any>('/api/auth/canva/status');
      setCanvaConnected(response.connected);
    } catch (error) {
      console.error('Failed to check Canva status:', error);
      setCanvaConnected(false);
    }
  };

  const connectCanva = async () => {
    try {
      const response = await apiGet<any>('/api/auth/canva');
      if (response.authUrl) {
        window.location.href = response.authUrl;
      } else {
        alert('נכשל ליצור קישור התחברות ל-Canva');
      }
    } catch (error) {
      console.error('Failed to initiate Canva OAuth:', error);
      alert('נכשל להתחבר ל-Canva');
    }
  };

  const checkGoogleStatus = async () => {
    try {
      const response = await apiGet<any>('/api/auth/google/status');
      setGoogleConnected(response.connected);
    } catch (error) {
      console.error('Failed to check Google status:', error);
      setGoogleConnected(false);
    }
  };

  const connectGoogle = async () => {
    try {
      const response = await apiGet<any>('/api/auth/google');
      if (response.authUrl) {
        window.location.href = response.authUrl;
      } else {
        alert('נכשל ליצור קישור התחברות ל-Google');
      }
    } catch (error) {
      console.error('Failed to initiate Google OAuth:', error);
      alert('נכשל להתחבר ל-Google');
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      const [statsData, agentsData] = await Promise.all([
        apiGet<{ success: boolean; stats: SystemStats }>('/api/dashboard/stats'),
        apiGet<{ success: boolean; agents: Agent[] }>('/api/agents'),
      ]);

      setStats(statsData.stats);
      setAgents(agentsData.agents || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('שגיאה בטעינת נתונים');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteAction = async (actionId: string, jobId: string) => {
    console.log('Executing action', { actionId, jobId });

    try {
      const response = await apiPost<any>(`/api/jobs/${jobId}/actions`, {
        actionId,
        action: 'approve',
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to execute action');
      }

      // Update message with action result
      setMessages((prev) =>
        prev.map((msg) =>
          msg.jobId === jobId
            ? {
                ...msg,
                content: msg.content + '\n\n---\n\n✅ ' + response.message,
                pendingAction: undefined,
              }
            : msg
        )
      );
    } catch (error) {
      console.error('Failed to execute action:', error);
      throw error;
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isSending) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date(),
      status: 'sent',
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsSending(true);

    // Add "thinking" agent message with friendly status
    const agentMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: 'agent',
      content: '🤔 מנתח את הבקשה שלך...',
      timestamp: new Date(),
      status: 'sending',
    };
    setMessages((prev) => [...prev, agentMessage]);

    // Update message with real-time logs
    const updateProgress = (text: string) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === agentMessage.id && msg.status === 'sending'
            ? { ...msg, content: text }
            : msg
        )
      );
    };

    try {
      if (selectedAgent) {
        // Run specific agent - immediate response
        const response = await apiPost<any>(`/api/agents/${selectedAgent}/run`, {
          input: content,
        });

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === agentMessage.id
              ? {
                  ...msg,
                  content: response.output || response.structured || 'הושלם בהצלחה',
                  status: 'sent' as const,
                  agentName: response.agentName || 'Agent',
                }
              : msg
          )
        );
      } else {
        // Orchestrator - create job and poll for result
        const response = await apiPost<any>('/api/jobs', {
          input: content,
        });

        const jobId = response.job?.id;
        
        if (!jobId) {
          throw new Error('No job ID returned');
        }

        // Poll for result AND logs - increased timeout for multi-agent execution
        let attempts = 0;
        const maxAttempts = 150; // 5 minutes timeout for complex jobs (150 * 2s = 300s)
        let lastLogCount = 0;
        
        const pollInterval = setInterval(async () => {
          attempts++;
          
          try {
            // Fetch both result and logs in parallel
            const [jobResult, logsResult] = await Promise.all([
              apiGet<any>(`/api/jobs/${jobId}/result`),
              apiGet<any>(`/api/jobs/${jobId}/logs`),
            ]);
            
            // Update progress with real logs
            if (logsResult?.logs && logsResult.logs.length > lastLogCount) {
              const latestLogs = logsResult.logs.slice(lastLogCount);
              const logMessages = latestLogs.map((log: any) => `${log.message}`).join('\n');
              updateProgress(logMessages || '⚙️ מעבד...');
              lastLogCount = logsResult.logs.length;
            } else if (jobResult.status === 'running') {
              // Show generic progress if no new logs
              updateProgress('⚙️ מעבד את המידע...');
            }
            
            // Check if completed or failed (check both 'completed' and 'done')
            if (jobResult.status === 'completed' || jobResult.status === 'done' || jobResult.status === 'success') {
              clearInterval(pollInterval);
              
              // Check for pending actions
              if (jobResult.pendingAction) {
                const pendingAction = jobResult.pendingAction;
                
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === agentMessage.id
                      ? {
                          ...msg,
                          content: jobResult.output || '✅ הושלם!',
                          status: 'sent' as const,
                          agentName: 'Agent OS',
                          pendingAction: pendingAction,
                          jobId: jobId,
                        }
                      : msg
                  )
                );
              } else {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === agentMessage.id
                      ? {
                          ...msg,
                          content: jobResult.output || '✅ הושלם בהצלחה!',
                          status: 'sent' as const,
                          agentName: 'Agent OS',
                          jobId: jobId,
                        }
                      : msg
                  )
                );
              }
            } else if (jobResult.status === 'failed') {
              clearInterval(pollInterval);
              
              // Format friendly error message
              const friendlyError = jobResult.error?.includes('Agent not found') 
                ? '😅 הסוכן המבוקש לא זמין כרגע. אנסה להשתמש בסוכן אחר...'
                : jobResult.error || '❌ משהו השתבש בעיבוד הבקשה';
              
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === agentMessage.id
                    ? {
                        ...msg,
                        content: friendlyError,
                        status: 'error' as const,
                      }
                    : msg
                )
              );
            } else if (attempts >= maxAttempts) {
              // Max timeout reached - still show latest logs
              clearInterval(pollInterval);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === agentMessage.id
                    ? {
                        ...msg,
                        content: msg.content + '\n\n⏱️ העיבוד לוקח זמן רב. תוכל לראות את הסטטוס בלוגים למעלה.',
                        status: 'sent' as const,
                      }
                    : msg
                )
              );
            } else if (jobResult.status === 'running' || jobResult.status === 'pending') {
              // Still running, continue polling (no action needed)
              // Logs are already being updated above
            } else {
              // Unknown status - stop polling to avoid infinite loop
              console.warn('Unknown job status:', jobResult.status);
              clearInterval(pollInterval);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === agentMessage.id
                    ? {
                        ...msg,
                        content: '⚠️ סטטוס לא ידוע. אנא רענן את הדף.',
                        status: 'error' as const,
                      }
                    : msg
                )
              );
            }
          } catch (pollError) {
            // Only clear interval on actual errors (not 404 which might be temporary)
            if ((pollError as any).status !== 404) {
              clearInterval(pollInterval);
              throw pollError;
            }
            // For 404, continue polling (job might not be ready yet)
          }
        }, 2000); // Poll every 2 seconds instead of 1 (reduces API load)
      }
    } catch (err: any) {
      console.error('Failed to send message:', err);
      
      // Update with error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === agentMessage.id
            ? {
                ...msg,
                content: 'שגיאה בעיבוד הבקשה. אנא נסה שוב.',
                status: 'error' as const,
              }
            : msg
        )
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickAction = (prompt: string) => {
    handleSendMessage(prompt);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-400">טוען נתונים...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-120px)]">
        {/* Top Stats Bar - Compact */}
        {stats && messages.length === 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="glass rounded-lg p-3">
                <p className="text-gray-400 text-xs">סוכנים פעילים</p>
                <p className="text-xl font-bold text-white">
                  {stats.activeAgents}
                  <span className="text-gray-500 text-sm">/{stats.totalAgents}</span>
                </p>
              </div>
              <div className="glass rounded-lg p-3">
                <p className="text-gray-400 text-xs">ריצות היום</p>
                <p className="text-xl font-bold text-white">{stats.executionsToday}</p>
              </div>
              <div className="glass rounded-lg p-3">
                <p className="text-gray-400 text-xs">שיעור הצלחה</p>
                <p
                  className={`text-xl font-bold ${
                    stats.successRate >= 80
                      ? 'text-green-400'
                      : stats.successRate >= 50
                      ? 'text-yellow-400'
                      : 'text-red-400'
                  }`}
                >
                  {stats.successRate}%
                </p>
              </div>
              <Link href="/dashboard/analytics" className="glass rounded-lg p-3 hover:bg-white/10 transition-all group cursor-pointer">
                <p className="text-gray-400 text-xs">ניתוח מלא</p>
                <p className="text-xl font-bold text-purple-400 group-hover:text-purple-300">
                  צפה בדשבורד →
                </p>
              </Link>
            </div>

            {/* Canva Connection Status */}
            {canvaConnected === false && (
              <div className="glass rounded-lg p-3 mb-6 border border-purple-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">🎨</div>
                    <div>
                      <p className="text-white font-medium">חבר את Canva</p>
                      <p className="text-gray-400 text-xs">צור דיזיינים, ייצא תוכן, העלה assets</p>
                    </div>
                  </div>
                  <button
                    onClick={connectCanva}
                    className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    התחבר ל-Canva
                  </button>
                </div>
              </div>
            )}

            {canvaConnected === true && (
              <div className="glass rounded-lg p-3 mb-6 border border-green-500/30">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">🎨</div>
                  <div>
                    <p className="text-green-400 font-medium">✓ Canva מחובר</p>
                    <p className="text-gray-400 text-xs">אפשר ליצור ולערוך דיזיינים</p>
                  </div>
                </div>
              </div>
            )}

            {/* Google Connection Status */}
            {googleConnected === false && (
              <div className="glass rounded-lg p-3 mb-6 border border-blue-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">📧</div>
                    <div>
                      <p className="text-white font-medium">חבר את Google</p>
                      <p className="text-gray-400 text-xs">שלח מיילים, קבע פגישות, גישה ל-Drive</p>
                    </div>
                  </div>
                  <button
                    onClick={connectGoogle}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    התחבר ל-Google
                  </button>
                </div>
              </div>
            )}

            {googleConnected === true && (
              <div className="glass rounded-lg p-3 mb-6 border border-green-500/30">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">📧</div>
                  <div>
                    <p className="text-green-400 font-medium">✓ Google מחובר</p>
                    <p className="text-gray-400 text-xs">אפשר לשלוח מיילים ולקבוע פגישות</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Welcome / Quick Actions */}
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-center mb-8">
              <div className="w-20 h-20 mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto animate-pulse">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">שלום! איך אפשר לעזור?</h1>
              <p className="text-gray-400">בחר פעולה מהירה או כתוב בקשה בשפה חופשית</p>
            </div>

            {/* Quick Action Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl w-full">
              {quickActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickAction(action.prompt)}
                  className="glass rounded-xl p-4 hover:bg-white/10 transition-all group text-center"
                >
                  <div className="text-4xl mb-2">{action.icon}</div>
                  <p className="text-white font-medium group-hover:text-purple-300 transition-colors">
                    {action.title}
                  </p>
                </button>
              ))}
            </div>

            {/* Popular Agents */}
            <div className="mt-8 max-w-4xl w-full">
              <h3 className="text-white/60 text-sm mb-3">סוכנים פופולריים</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {agents
                  .sort((a, b) => (b.executionsToday || 0) - (a.executionsToday || 0))
                  .slice(0, 6)
                  .map((agent) => (
                    <Link
                      key={agent.id}
                      href={`/dashboard/agents/${agent.id}`}
                      className="glass rounded-lg p-3 hover:bg-white/10 transition-all group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className={`w-2 h-2 rounded-full bg-gradient-to-r ${
                            domainColors[agent.domain] || domainColors.general
                          }`}
                        />
                        <p className="text-white text-sm font-medium truncate group-hover:text-purple-300">
                          {agent.nameHebrew}
                        </p>
                      </div>
                      <p className="text-gray-500 text-xs">{agent.executionsToday || 0} ריצות היום</p>
                    </Link>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Chat Messages */}
        {messages.length > 0 && (
          <div className="flex-1 overflow-y-auto mb-4 space-y-4 px-2">
            {messages.map((message) => (
              <ChatMessage 
                key={message.id} 
                message={message}
                onExecuteAction={handleExecuteAction}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Chat Input */}
        <div className="flex-shrink-0">
          <div className="flex items-end gap-3 mb-2">
            <AgentSelector agents={agents} selectedAgent={selectedAgent} onSelect={setSelectedAgent} />
            {selectedAgent && (
              <button
                onClick={() => setSelectedAgent(null)}
                className="text-gray-400 hover:text-white text-xs transition-colors"
              >
                ביטול בחירה
              </button>
            )}
          </div>
          <ChatInput onSend={handleSendMessage} disabled={isSending} />
          <p className="text-gray-500 text-xs mt-2 text-center">
            המערכת מופעלת על ידי {stats?.activeAgents || 0} סוכני AI
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
