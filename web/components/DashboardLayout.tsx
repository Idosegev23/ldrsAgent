'use client';

/**
 * Dashboard Layout Component
 * Unified layout for all dashboard pages
 */

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ProtectedRoute from './ProtectedRoute';
import { useAuth } from '../contexts/AuthContext';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

interface NavItem {
  href: string;
  label: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'סוכנים' },
  { href: '/dashboard/integrations', label: 'אינטגרציות', adminOnly: true },
  { href: '/dashboard/analytics', label: 'אנליטיקה', adminOnly: true },
  { href: '/settings', label: 'הגדרות' },
];

export default function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();

  // Check if user is admin
  const isAdmin = user?.email && ['cto@ldrsgroup.com', 'yoav@ldrsgroup.com'].includes(user.email.toLowerCase());

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname?.startsWith('/dashboard/agents');
    }
    return pathname === href || pathname?.startsWith(href + '/');
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        {/* Header */}
        <header className="glass border-b border-white/10 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/dashboard" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">L</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Leadrs Agents</h1>
                  <p className="text-gray-400 text-xs">Agent OS</p>
                </div>
              </Link>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-white font-medium text-sm">
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                </p>
                <p className="text-gray-400 text-xs">{user?.email}</p>
              </div>
              {isAdmin && (
                <span className="bg-purple-500/20 text-purple-300 text-xs px-2 py-1 rounded-full">
                  Admin
                </span>
              )}
              <button
                onClick={signOut}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-200 px-4 py-2 rounded-lg transition-all text-sm"
              >
                התנתק
              </button>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <nav className="border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex gap-1 py-2">
              {navItems
                .filter((item) => !item.adminOnly || isAdmin)
                .map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive(item.href)
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
            </div>
          </div>
        </nav>

        {/* Page Title */}
        {(title || subtitle) && (
          <div className="border-b border-white/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              {title && <h1 className="text-2xl font-bold text-white">{title}</h1>}
              {subtitle && <p className="text-gray-400 mt-1">{subtitle}</p>}
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-white/5 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <p className="text-gray-500 text-xs text-center">
              Leadrs Agent OS v1.0 | Built with AI
            </p>
          </div>
        </footer>
      </div>
    </ProtectedRoute>
  );
}
