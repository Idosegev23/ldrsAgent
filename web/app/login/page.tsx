'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { FaGoogle } from 'react-icons/fa';

function LoginContent() {
  const { isAuthenticated, isLoading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    const authError = searchParams.get('error');
    if (authError) {
      switch (authError) {
        case 'invalid_domain':
          setError('הגישה מוגבלת למשתמשי ldrsgroup.com בלבד');
          break;
        case 'auth_failed':
          setError('ההתחברות נכשלה. אנא נסה שנית');
          break;
        default:
          setError('אירעה שגיאה. אנא נסה שנית');
      }
    }
  }, [searchParams]);

  const handleGoogleSignIn = async () => {
    try {
      setError(null);
      setSigningIn(true);
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'ההתחברות נכשלה');
    } finally {
      setSigningIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">Leaders Agents</h1>
          <p className="text-gray-400">מערכת ניהול AI Agents</p>
        </div>

        <div className="glass rounded-xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-white">התחברות</h2>
            <p className="text-gray-400 text-sm">השתמש בחשבון Google שלך מ-ldrsgroup.com</p>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white hover:bg-gray-100 text-gray-900 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaGoogle className="text-xl" />
            {signingIn ? 'מתחבר...' : 'התחבר עם Google'}
          </button>

          <div className="pt-4 border-t border-gray-700">
            <p className="text-gray-500 text-xs text-center">
              אנא השתמש רק בכתובת email של ldrsgroup.com
            </p>
          </div>
        </div>

        <div className="text-center">
          <p className="text-gray-500 text-sm">
            © 2025 Leaders Group. כל הזכויות שמורות
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
