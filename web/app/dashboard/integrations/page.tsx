'use client';

/**
 * Integrations Status Page
 * Monitor all integrations health + Connect new integrations
 */

import { useEffect, useState } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { apiGet, apiPost } from '@/lib/api';

interface IntegrationHealth {
  type: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  lastCheck: string;
  lastSuccess: string | null;
  errorCount: number;
  uptimePercentage: number;
}

interface IntegrationConfig {
  icon: string;
  name: string;
  description: string;
  color: string;
  authType: 'oauth' | 'apikey' | 'serviceaccount';
  requiredFields?: { key: string; label: string }[];
}

// Integration metadata and configuration
const integrationConfigs: Record<string, IntegrationConfig> = {
  google_drive: {
    icon: '📁',
    name: 'Google Drive',
    color: 'from-yellow-500 to-orange-500',
    description: 'מאגר הידע והמסמכים',
    authType: 'serviceaccount',
    requiredFields: [
      { key: 'GOOGLE_SERVICE_ACCOUNT_KEY', label: 'Service Account JSON' },
      { key: 'GOOGLE_DRIVE_FOLDER_ID', label: 'Folder ID' },
    ],
  },
  gmail: {
    icon: '📧',
    name: 'Gmail',
    color: 'from-red-500 to-pink-500',
    description: 'שליחה וקריאת מיילים',
    authType: 'oauth',
    requiredFields: [
      { key: 'GOOGLE_CLIENT_ID', label: 'Client ID' },
      { key: 'GOOGLE_CLIENT_SECRET', label: 'Client Secret' },
    ],
  },
  calendar: {
    icon: '📅',
    name: 'Google Calendar',
    color: 'from-blue-500 to-cyan-500',
    description: 'ניהול יומנים ופגישות',
    authType: 'oauth',
    requiredFields: [
      { key: 'GOOGLE_CLIENT_ID', label: 'Client ID' },
      { key: 'GOOGLE_CLIENT_SECRET', label: 'Client Secret' },
    ],
  },
  clickup: {
    icon: '✅',
    name: 'ClickUp',
    color: 'from-purple-500 to-pink-500',
    description: 'ניהול משימות ופרויקטים',
    authType: 'apikey',
    requiredFields: [
      { key: 'CLICKUP_API_TOKEN', label: 'API Token' },
      { key: 'CLICKUP_WORKSPACE_ID', label: 'Workspace ID' },
    ],
  },
  whatsapp: {
    icon: '💬',
    name: 'WhatsApp',
    color: 'from-green-500 to-emerald-500',
    description: 'תקשורת ווטסאפ',
    authType: 'apikey',
    requiredFields: [
      { key: 'GREEN_API_INSTANCE_ID', label: 'Instance ID' },
      { key: 'GREEN_API_TOKEN', label: 'Token' },
    ],
  },
  apify: {
    icon: '🕷️',
    name: 'Apify',
    color: 'from-indigo-500 to-violet-500',
    description: 'סריקת אתרים ומחקר',
    authType: 'apikey',
    requiredFields: [{ key: 'APIFY_TOKEN', label: 'API Token' }],
  },
};

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchDebugInfo = async () => {
    try {
      const data = await apiGet<any>('/api/debug/env');
      setDebugInfo(data);
      setShowDebug(true);
    } catch (err) {
      console.error('Failed to fetch debug info:', err);
    }
  };

  const fetchIntegrations = async () => {
    try {
      setIsLoading(true);
      const data = await apiGet<{ success: boolean; integrations: IntegrationHealth[] }>(
        '/api/dashboard/integrations'
      );
      setIntegrations(data.integrations || []);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch integrations:', err);
      if (err.message?.includes('403')) {
        setError('אין לך הרשאה לצפות בדף זה');
      } else {
        setError('שגיאה בטעינת נתונים');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getSetupInstructions = (type: string) => {
    const instructions: Record<string, string> = {
      google_drive: 'הוסף GOOGLE_SERVICE_ACCOUNT_KEY ו-GOOGLE_DRIVE_FOLDER_ID ל-web/.env.local',
      gmail: 'הוסף GOOGLE_CLIENT_ID ו-GOOGLE_CLIENT_SECRET ל-web/.env.local',
      calendar: 'הוסף GOOGLE_CLIENT_ID ו-GOOGLE_CLIENT_SECRET ל-web/.env.local',
      clickup: 'הוסף CLICKUP_API_TOKEN ו-CLICKUP_WORKSPACE_ID ל-web/.env.local',
      whatsapp: 'הוסף GREEN_API_INSTANCE_ID ו-GREEN_API_TOKEN ל-web/.env.local',
      apify: 'הוסף APIFY_TOKEN ל-web/.env.local',
    };
    return instructions[type] || 'הוסף את המפתחות הנדרשים ל-web/.env.local';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'down':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'degraded':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'down':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'תקין';
      case 'degraded':
        return 'ביצועים ירודים';
      case 'down':
        return 'חסר הגדרה';
      default:
        return 'לא מוגדר';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return '✓';
      case 'degraded':
        return '!';
      case 'down':
        return '✕';
      default:
        return '?';
    }
  };

  return (
    <DashboardLayout>
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-400">טוען נתוני אינטגרציות...</p>
          </div>
        </div>
      ) : error ? (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-red-200 mb-4">{error}</p>
          <button
            onClick={fetchIntegrations}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-all"
          >
            נסה שוב
          </button>
        </div>
      ) : (
        <>
          {/* Header Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="glass rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <span className="text-2xl">✓</span>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">תקינות</p>
                  <p className="text-2xl font-bold text-green-400">
                    {integrations.filter((i) => i.status === 'healthy').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="glass rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                  <span className="text-2xl">!</span>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">ביצועים ירודים</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {integrations.filter((i) => i.status === 'degraded').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="glass rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <span className="text-2xl">✕</span>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">לא זמינות</p>
                  <p className="text-2xl font-bold text-red-400">
                    {integrations.filter((i) => i.status === 'down' || i.status === 'unknown').length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Integrations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {integrations.map((integration) => {
              const config = integrationConfigs[integration.type] || {
                icon: '🔌',
                name: integration.type,
                description: '',
                color: 'from-gray-500 to-slate-500',
                authType: 'apikey' as const,
              };

              const isConfigured = integration.status === 'healthy';
              const needsSetup = integration.status === 'down' || integration.status === 'unknown';

              return (
                <div
                  key={integration.type}
                  className={`glass rounded-xl p-6 transition-all hover:bg-white/5 border ${
                    isConfigured
                      ? 'border-green-500/20'
                      : needsSetup
                      ? 'border-red-500/20'
                      : 'border-white/10'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center text-2xl`}
                      >
                        {config.icon}
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">{config.name}</h3>
                        <p className="text-gray-400 text-sm">{config.description}</p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadgeColor(
                        integration.status
                      )}`}
                    >
                      <span>{getStatusIcon(integration.status)}</span>
                      <span>{getStatusText(integration.status)}</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="glass rounded-lg p-3">
                      <p className="text-gray-400 text-xs">זמן פעולה</p>
                      <p className="text-white font-semibold">
                        {integration.uptimePercentage || 0}%
                      </p>
                    </div>
                    <div className="glass rounded-lg p-3">
                      <p className="text-gray-400 text-xs">שגיאות</p>
                      <p className="text-white font-semibold">{integration.errorCount}</p>
                    </div>
                  </div>

                  {/* Last Check */}
                  <p className="text-gray-500 text-xs mb-4">
                    בדיקה אחרונה: {new Date(integration.lastCheck).toLocaleString('he-IL')}
                  </p>

                  {/* Status Info */}
                  {needsSetup && (
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                      <p className="text-orange-200 text-xs font-medium mb-1">
                        ⚠️ נדרשת הגדרה
                      </p>
                      <p className="text-orange-300/80 text-xs">
                        {getSetupInstructions(integration.type)}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Help Card */}
          <div className="glass rounded-xl p-6 mt-8 border border-blue-500/20">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">💡</span>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-3">המערכת בודקת את המפתחות מ-web/.env.local</h3>
                <div className="text-gray-400 text-sm space-y-2">
                  <p>
                    אם אינטגרציה מסומנת כ-<span className="text-red-300">"חסר הגדרה"</span>, זה אומר שהמפתחות חסרים בקובץ או שהשרת לא עשה restart.
                  </p>
                  <div className="bg-white/5 rounded-lg p-3 mt-3">
                    <p className="text-white text-xs font-medium mb-2">פתרון בעיות:</p>
                    <ol className="text-xs text-gray-300 space-y-1 mr-4">
                      <li>1. וודא ש-<code className="text-purple-400">web/.env.local</code> מכיל את המפתחות</li>
                      <li>2. הפעל מחדש את השרת (Ctrl+C במטרמינל ואז npm run dev)</li>
                      <li>3. רענן את הדף</li>
                    </ol>
                  </div>
                  <div className="pt-3 border-t border-white/10 flex gap-3">
                    <button
                      onClick={fetchIntegrations}
                      className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-2 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      רענן סטטוס
                    </button>
                    <button
                      onClick={fetchDebugInfo}
                      className="text-gray-400 hover:text-gray-300 text-sm flex items-center gap-2 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      בדוק מפתחות
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Debug Modal */}
      {showDebug && debugInfo && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 max-w-2xl w-full border border-white/20 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">סטטוס Environment Variables</h2>
              <button
                onClick={() => setShowDebug(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-2">
              {Object.entries(debugInfo.env || {}).map(([key, info]: [string, any]) => (
                <div
                  key={key}
                  className={`glass rounded-lg p-3 ${
                    info.exists ? 'border border-green-500/20' : 'border border-red-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <code className="text-xs text-gray-300">{key}</code>
                    <div className="flex items-center gap-3">
                      {info.exists ? (
                        <>
                          <span className="text-xs text-gray-400">{info.length} chars</span>
                          <span className="text-green-400 text-sm">✓</span>
                        </>
                      ) : (
                        <span className="text-red-400 text-sm">✕ חסר</span>
                      )}
                    </div>
                  </div>
                  {info.exists && info.preview && (
                    <p className="text-xs text-gray-500 mt-1 font-mono">{info.preview}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <p className="text-blue-200 text-sm">
                💡 אם מפתח מסומן כ-"חסר", הוסף אותו ל-<code className="text-purple-400">web/.env.local</code> והפעל מחדש את השרת.
              </p>
            </div>

            <button
              onClick={() => setShowDebug(false)}
              className="w-full mt-4 glass hover:bg-white/10 text-white font-medium py-3 rounded-lg transition-all"
            >
              סגור
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
