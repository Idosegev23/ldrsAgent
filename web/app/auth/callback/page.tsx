'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        console.error('Auth error:', error);
        router.push(`/login?error=${encodeURIComponent(error)}`);
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (exchangeError) {
          console.error('Session exchange error:', exchangeError);
          router.push('/login?error=auth_failed');
          return;
        }

        // Check domain validation
        const { data: { session } } = await supabase.auth.getSession();
        const emailDomain = session?.user?.email?.split('@')[1];
        
        if (emailDomain !== 'ldrsgroup.com') {
          await supabase.auth.signOut();
          router.push('/login?error=invalid_domain');
          return;
        }

        // Redirect to dashboard
        router.push('/dashboard');
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
        <p className="text-white">מתחבר...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white">טוען...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
