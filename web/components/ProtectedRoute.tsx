'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export default function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    } else if (!isLoading && isAuthenticated && adminOnly) {
      const userRole = user?.user_metadata?.role || user?.role || 'user';
      if (userRole !== 'admin') {
        router.push('/dashboard');
      }
    }
  }, [isAuthenticated, isLoading, router, adminOnly, user]);

  if (isLoading || (!isAuthenticated && !isLoading) || (adminOnly && user?.role !== 'admin')) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>טוען...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
