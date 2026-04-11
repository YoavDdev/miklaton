'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// Navigation configuration by role
const NAV_CONFIG = {
  admin: {
    label: 'מנהל מערכת',
    color: 'bg-red-600',
    links: [
      { href: '/admin', label: 'ניהול מערכת', icon: '⚙️' },
      { href: '/admin/users', label: 'ניהול משתמשים', icon: '👥' },
      { href: '/events', label: 'אירועים', icon: '📋' },
      { href: '/on-call', label: 'אנשי קשר', icon: '👥' },
      { href: '/profile', label: 'פרופיל', icon: '👤' },
    ]
  },
  ceo: {
    label: 'מנכ"ל',
    color: 'bg-purple-600',
    links: [
      { href: '/ceo', label: 'מסך מנכ"ל', icon: '🎯' },
      { href: '/events', label: 'אירועים', icon: '📋' },
      { href: '/on-call', label: 'אנשי קשר', icon: '👥' },
      { href: '/on-call-query', label: 'מי בתורן?', icon: '🔍' },
      { href: '/profile', label: 'פרופיל', icon: '👤' },
    ]
  },
  call_center_manager: {
    label: 'מנהל מוקד',
    color: 'bg-blue-600',
    links: [
      { href: '/call-center-manager', label: 'ניהול מוקד', icon: '📞' },
      { href: '/operator', label: 'מסך מוקדן', icon: '🎧' },
      { href: '/events', label: 'אירועים', icon: '📋' },
      { href: '/on-call', label: 'אנשי קשר', icon: '�' },
      { href: '/profile', label: 'פרופיל', icon: '👤' },
    ]
  },
  sector_manager: {
    label: 'מנהל מכלול',
    color: 'bg-green-600',
    links: [
      { href: '/sector-manager', label: 'ניהול מכלול', icon: '🏢' },
      { href: '/events', label: 'אירועים', icon: '📋' },
      { href: '/on-call', label: 'אנשי קשר', icon: '�' },
      { href: '/on-call-query', label: 'מי בתורן?', icon: '🔍' },
      { href: '/profile', label: 'פרופיל', icon: '👤' },
    ]
  },
  operator: {
    label: 'מוקדן',
    color: 'bg-cyan-600',
    links: [
      { href: '/operator', label: 'מסך מוקדן', icon: '🎧' },
      { href: '/events', label: 'אירועים', icon: '📋' },
      { href: '/on-call', label: 'אנשי קשר', icon: '👥' },
      { href: '/on-call-query', label: 'מי בתורן?', icon: '🔍' },
      { href: '/profile', label: 'פרופיל', icon: '👤' },
    ]
  },
  inspector: {
    label: 'מפקח',
    color: 'bg-orange-600',
    links: [
      { href: '/inspector', label: 'מסך מפקח', icon: '🔍' },
      { href: '/inspection', label: 'ביקורות', icon: '📝' },
      { href: '/events', label: 'אירועים', icon: '📋' },
      { href: '/on-call', label: 'אנשי קשר', icon: '�' },
      { href: '/on-call-query', label: 'מי בתורן?', icon: '🔍' },
      { href: '/profile', label: 'פרופיל', icon: '👤' },
    ]
  },
  shelter_manager: {
    label: 'מנהל מקלטים',
    color: 'bg-teal-600',
    links: [
      { href: '/shelter-manager', label: 'ניהול מקלטים', icon: '🏠' },
      { href: '/events', label: 'אירועים', icon: '📋' },
      { href: '/on-call', label: 'אנשי קשר', icon: '�' },
      { href: '/on-call-query', label: 'מי בתורן?', icon: '🔍' },
      { href: '/profile', label: 'פרופיל', icon: '👤' },
    ]
  },
};

// Role display names
const ROLE_NAMES = {
  admin: 'מנהל מערכת',
  ceo: 'מנכ"ל',
  call_center_manager: 'מנהל מוקד',
  sector_manager: 'מנהל מכלול',
  operator: 'מוקדן',
  inspector: 'מפקח',
  shelter_manager: 'מנהל מקלטים',
};

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      // First try localStorage
      const username = localStorage.getItem('username');
      const fullName = localStorage.getItem('full_name');
      const role = localStorage.getItem('role');

      if (username && role) {
        setUser({
          username,
          fullName: fullName || username,
          role,
        });
        setLoading(false);
        return;
      }

      // If not in localStorage, fetch from API
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            const userData = {
              username: data.user.full_name || data.user.email?.split('@')[0] || '',
              fullName: data.user.full_name || '',
              role: data.user.role,
            };
            setUser(userData);
            // Also save to localStorage for next time
            localStorage.setItem('username', userData.username);
            localStorage.setItem('full_name', userData.fullName);
            localStorage.setItem('role', userData.role);
            localStorage.setItem('email', data.user.email);
            localStorage.setItem('userId', data.user.id);
          }
        }
      } catch (e) {
        console.error('Failed to fetch user:', e);
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // Silent fail
    }
    localStorage.clear();
    router.push('/login');
  };

  // Don't show navbar on public pages
  if (!user && !loading) return null;

  // Don't show on login/register pages
  if (pathname === '/login' || pathname === '/register') return null;

  const userConfig = NAV_CONFIG[user?.role] || NAV_CONFIG.operator;
  const roleName = ROLE_NAMES[user?.role] || 'משתמש';
  const roleColor = userConfig?.color || 'bg-gray-600';

  const isActiveLink = (href) => {
    if (href === '/admin' && pathname.startsWith('/admin')) return true;
    return pathname === href;
  };

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Desktop Nav */}
          <div className="flex items-center">
            {/* Logo */}
            <button
              onClick={() => router.push('/dashboard')}
              className="flex-shrink-0 flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md">
                מ
              </div>
              <span className="hidden sm:block font-bold text-gray-800 text-lg">מקלטון</span>
            </button>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex mr-6 space-x-1 space-x-reverse">
              {userConfig.links.map((link) => (
                <button
                  key={link.href}
                  onClick={() => router.push(link.href)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    isActiveLink(link.href)
                      ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span>{link.icon}</span>
                  <span>{link.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* User Info & Actions */}
          <div className="flex items-center gap-3">
            {/* Role Badge - Desktop */}
            <span className={`hidden md:inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-white ${roleColor}`}>
              {roleName}
            </span>

            {/* User Name */}
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium text-gray-900">{user?.fullName}</span>
              <span className="text-xs text-gray-500">{user?.username}</span>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            {/* Logout Button - Desktop */}
            <button
              onClick={handleLogout}
              className="hidden lg:flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              התנתק
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-gray-200 shadow-lg">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {/* User Info - Mobile */}
            <div className="px-3 py-3 border-b border-gray-200 mb-2">
              <p className="text-sm font-medium text-gray-900">{user?.fullName}</p>
              <p className="text-xs text-gray-500">{user?.username}</p>
              <span className={`inline-flex items-center mt-2 px-2 py-0.5 rounded text-xs font-medium text-white ${roleColor}`}>
                {roleName}
              </span>
            </div>

            {/* Mobile Links */}
            {userConfig.links.map((link) => (
              <button
                key={link.href}
                onClick={() => {
                  router.push(link.href);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-right px-3 py-3 rounded-md text-base font-medium flex items-center gap-3 ${
                  isActiveLink(link.href)
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className="text-xl">{link.icon}</span>
                <span>{link.label}</span>
                {isActiveLink(link.href) && (
                  <span className="mr-auto text-blue-600">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
              </button>
            ))}

            {/* Mobile Logout */}
            <div className="border-t border-gray-200 mt-3 pt-3">
              <button
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-right px-3 py-3 rounded-md text-base font-medium text-red-600 hover:bg-red-50 flex items-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                התנתק מהמערכת
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
