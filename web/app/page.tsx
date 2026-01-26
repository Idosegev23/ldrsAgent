'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        // אם מחובר - הפנה ל-Dashboard
        router.push('/dashboard');
      } else {
        // אם לא מחובר - הפנה ל-Login
        router.push('/login');
      }
    }
  }, [isAuthenticated, isLoading, router]);

  // מסך טעינה בזמן הבדיקה
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 text-white">
      <div className="text-center">
        <div className="w-20 h-20 mb-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto animate-pulse">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold mb-2">Leadrs Agent OS</h1>
        <p className="text-white/60">טוען את המערכת...</p>
      </div>
    </div>
  );
}
