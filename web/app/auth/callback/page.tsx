'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';

export default function AuthCallbackPage() {
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

        // IMPORTANT: Save Google OAuth tokens for API access
        // Supabase gives us provider tokens that we can use for Drive/Calendar/Gmail
        if (session?.provider_token && session?.user?.id) {
          try {
            console.log('Saving Google OAuth tokens for user:', session.user.email);
            
            // Call our API to save the tokens
            await fetch('/api/auth/google/save-tokens', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                userId: session.user.id,
                accessToken: session.provider_token,
                refreshToken: session.provider_refresh_token,
                email: session.user.email
              })
            });
            
            console.log('✅ Google tokens saved successfully');
          } catch (tokenError) {
            console.error('Failed to save Google tokens:', tokenError);
            // Continue anyway - they can connect later
          }
        }

        // Success - redirect to dashboard
        router.push('/dashboard');
      } else {
        // No code in URL, redirect to login
        router.push('/login');
      }
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p>מאמת התחברות...</p>
      </div>
    </div>
  );
}
