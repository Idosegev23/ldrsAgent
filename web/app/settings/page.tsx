'use client';

/**
 * Settings Page
 * User preferences and integrations
 */

import { useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { GoogleConnect } from '../../components/GoogleConnect';
import { useAuth } from '../../contexts/AuthContext';

export default function SettingsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [autoMode, setAutoMode] = useState(true);
  const [copied, setCopied] = useState(false);

  const copyApiUrl = () => {
    navigator.clipboard.writeText('http://localhost:4000/api');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DashboardLayout title="הגדרות" subtitle="ניהול חשבון והעדפות">
      <div className="max-w-3xl space-y-6">
        {/* Profile section */}
        <section className="glass rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="text-xl">👤</span>
            פרופיל
          </h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">שם</label>
                <input
                  type="text"
                  value={user?.user_metadata?.full_name || ''}
                  readOnly
                  className="w-full glass text-white rounded-lg px-4 py-3 bg-white/5"
                />
              </div>
              
              <div>
                <label className="block text-gray-400 text-sm mb-2">אימייל</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  readOnly
                  className="w-full glass text-white rounded-lg px-4 py-3 bg-white/5"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-3 pt-2">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xl font-bold">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <p className="text-white font-medium">
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                </p>
                <p className="text-gray-400 text-sm">{user?.email}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Preferences section */}
        <section className="glass rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            העדפות
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 glass rounded-lg">
              <div>
                <div className="text-white font-medium">התראות</div>
                <div className="text-gray-400 text-sm">קבל התראות על משימות חדשות</div>
              </div>
              <button
                onClick={() => setNotifications(!notifications)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  notifications ? 'bg-purple-600' : 'bg-gray-600'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    notifications ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 glass rounded-lg">
              <div>
                <div className="text-white font-medium">מצב אוטומטי</div>
                <div className="text-gray-400 text-sm">תן למערכת לבחור סוכן אוטומטית</div>
              </div>
              <button
                onClick={() => setAutoMode(!autoMode)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  autoMode ? 'bg-purple-600' : 'bg-gray-600'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    autoMode ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Google Integration section */}
        <section className="glass rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="text-xl">🔗</span>
            חיבור Google
          </h2>
          <GoogleConnect />
        </section>

        {/* API section */}
        <section className="glass rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="text-xl">🔌</span>
            API
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">כתובת API</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value="http://localhost:4000/api"
                  readOnly
                  className="flex-1 glass text-gray-300 rounded-lg px-4 py-3 bg-white/5 font-mono text-sm"
                />
                <button
                  onClick={copyApiUrl}
                  className={`px-4 py-3 rounded-lg text-white transition-all ${
                    copied
                      ? 'bg-green-600'
                      : 'glass hover:bg-white/10'
                  }`}
                >
                  {copied ? '✓' : 'העתק'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">סטטוס</label>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-green-400">מחובר</span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10">
              <p className="text-gray-500 text-xs">
                השתמש ב-API כדי לשלוח בקשות לסוכנים מכל מקום. 
                ראה את התיעוד המלא ב-<code className="text-purple-400">/api/docs</code>
              </p>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="glass rounded-xl p-6 border border-red-500/20">
          <h2 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            אזור מסוכן
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-medium">נקה היסטוריה</div>
                <div className="text-gray-400 text-sm">מחק את כל היסטוריית השיחות</div>
              </div>
              <button className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg transition-all text-sm">
                נקה
              </button>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
