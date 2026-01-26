'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { FaGoogle } from 'react-icons/fa';

export default function LoginPage() {
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
          setError(authError);
      }
    }
  }, [searchParams]);

  const handleGoogleLogin = async () => {
    try {
      setSigningIn(true);
      setError(null);
      await signInWithGoogle();
      // Supabase will redirect automatically
    } catch (err) {
      console.error('Google login error:', err);
      setError('שגיאה בהתחברות. אנא נסה שנית');
      setSigningIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>טוען...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 text-white p-4">
      <div className="glass p-8 rounded-2xl shadow-2xl text-center max-w-md w-full backdrop-blur-lg bg-white/10 border border-white/20">
        <h1 className="text-4xl font-bold mb-3 text-white">Leadrs Agent OS</h1>
        <p className="text-gray-200 mb-8">מערכת AI רב-סוכנים</p>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-white p-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={signingIn}
          className="bg-white hover:bg-gray-100 text-gray-900 font-bold py-4 px-6 rounded-lg flex items-center justify-center w-full transition duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {signingIn ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900 ml-3"></div>
              מתחבר...
            </>
          ) : (
            <>
              <FaGoogle className="ml-3 text-xl" />
              התחבר עם Google
            </>
          )}
        </button>

        <p className="text-gray-300 text-sm mt-6">
          גישה מוגבלת למשתמשי <span className="font-semibold">ldrsgroup.com</span>
        </p>
      </div>
    </div>
  );
}
