'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { municipalityConfig } from '@/lib/municipality';

// Per-role navigation config
// accent = color used for active link highlight and role badge
const NAV_CONFIG = {
  admin: {
    label: 'מנהל מערכת',
    accent: 'red',
    links: [
      { href: '/admin', label: 'ניהול מערכת', icon: '⚙️' },
      { href: '/admin/users', label: 'משתמשים', icon: '👥' },
      { href: '/events', label: 'אירועים', icon: '📋' },
      { href: '/on-call', label: 'ספר טלפונים', icon: '📖' },
      { href: '/profile', label: 'פרופיל', icon: '👤' },
    ],
  },
  ceo: {
    label: 'מנכ"ל',
    accent: 'purple',
    links: [
      { href: '/ceo', label: 'לוח בקרה', icon: '🎯' },
      { href: '/events', label: 'אירועים', icon: '📋' },
      { href: '/on-call', label: 'ספר טלפונים', icon: '📖' },
      { href: '/on-call-query', label: 'מי בתורן?', icon: '🔍' },
      { href: '/profile', label: 'פרופיל', icon: '👤' },
    ],
  },
  call_center_manager: {
    label: 'מנהל מוקד',
    accent: 'blue',
    links: [
      { href: '/call-center-manager', label: 'ניהול מוקד', icon: '📞' },
      { href: '/operator', label: 'מסך מוקדן', icon: '🎧' },
      { href: '/events', label: 'אירועים', icon: '📋' },
      { href: '/on-call', label: 'ספר טלפונים', icon: '👥' },
      { href: '/profile', label: 'פרופיל', icon: '👤' },
    ],
  },
  sector_manager: {
    label: 'מנהל מכלול',
    accent: 'green',
    links: [
      { href: '/sector-manager', label: 'ניהול מכלול', icon: '🏢' },
      { href: '/events', label: 'אירועים', icon: '📋' },
      { href: '/on-call', label: 'ספר טלפונים', icon: '👥' },
      { href: '/on-call-query', label: 'מי בתורן?', icon: '🔍' },
      { href: '/profile', label: 'פרופיל', icon: '👤' },
    ],
  },
  operator: {
    label: 'מוקדן',
    accent: 'cyan',
    links: [
      { href: '/operator', label: 'מסך מוקדן', icon: '🎧' },
      { href: '/events', label: 'אירועים', icon: '📋' },
      { href: '/on-call', label: 'ספר טלפונים', icon: '👥' },
      { href: '/on-call-query', label: 'מי בתורן?', icon: '🔍' },
      { href: '/profile', label: 'פרופיל', icon: '👤' },
    ],
  },
  inspector: {
    label: 'פקח',
    accent: 'orange',
    links: [
      { href: '/inspector', label: 'המשימות שלי', icon: '�' },
      { href: '/inspection', label: 'ביקורות', icon: '📝' },
      { href: '/events', label: 'אירועים', icon: '�' },
      { href: '/on-call', label: 'ספר טלפונים', icon: '📖' },
      { href: '/profile', label: 'פרופיל', icon: '👤' },
    ],
  },
  shelter_manager: {
    label: 'מנהל מקלטים',
    accent: 'teal',
    links: [
      { href: '/shelter-manager', label: 'ניהול מקלטים', icon: '🏠' },
      { href: '/events', label: 'אירועים', icon: '📋' },
      { href: '/on-call', label: 'ספר טלפונים', icon: '👥' },
      { href: '/on-call-query', label: 'מי בתורן?', icon: '🔍' },
      { href: '/profile', label: 'פרופיל', icon: '👤' },
    ],
  },
};

// Tailwind accent classes per color (needed because Tailwind purges dynamic classes)
const ACCENT_CLASSES = {
  red:    { badge: 'bg-red-600',    active: 'text-red-700 bg-red-50 border-red-500',    mobileActive: 'bg-red-50 text-red-700' },
  purple: { badge: 'bg-purple-600', active: 'text-purple-700 bg-purple-50 border-purple-500', mobileActive: 'bg-purple-50 text-purple-700' },
  blue:   { badge: 'bg-blue-600',   active: 'text-blue-700 bg-blue-50 border-blue-500',   mobileActive: 'bg-blue-50 text-blue-700' },
  green:  { badge: 'bg-green-600',  active: 'text-green-700 bg-green-50 border-green-500',  mobileActive: 'bg-green-50 text-green-700' },
  cyan:   { badge: 'bg-cyan-600',   active: 'text-cyan-700 bg-cyan-50 border-cyan-500',   mobileActive: 'bg-cyan-50 text-cyan-700' },
  orange: { badge: 'bg-orange-600', active: 'text-orange-700 bg-orange-50 border-orange-500', mobileActive: 'bg-orange-50 text-orange-700' },
  teal:   { badge: 'bg-teal-600',   active: 'text-teal-700 bg-teal-50 border-teal-500',   mobileActive: 'bg-teal-50 text-teal-700' },
};

// Pages that belong to a role – admin visiting these sees "back to admin" banner
const ROLE_PAGES = ['/operator', '/call-center-manager', '/sector-manager', '/inspector', '/shelter-manager', '/ceo'];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const username = localStorage.getItem('username');
      const fullName = localStorage.getItem('full_name');
      const role = localStorage.getItem('role');

      if (username && role) {
        setUser({ username, fullName: fullName || username, role });
        setLoading(false);
        return;
      }

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
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    localStorage.clear();
    router.push('/login');
  };

  // Hide on public pages
  if (!user && !loading) return null;
  if (pathname === '/login' || pathname === '/register') return null;
  if (pathname.startsWith('/event/live/') || pathname.startsWith('/event/join/')) return null;

  const config = NAV_CONFIG[user?.role] || NAV_CONFIG.operator;
  const accent = ACCENT_CLASSES[config.accent] || ACCENT_CLASSES.blue;

  // Admin visiting a role page → show slim "back to admin" banner instead of full nav
  const isAdminViewingRolePage =
    user?.role === 'admin' && ROLE_PAGES.some(p => pathname.startsWith(p));

  const isActiveLink = (href) => {
    if (href === '/admin') return pathname === '/admin';
    if (href !== '/' && pathname.startsWith(href)) return true;
    return pathname === href;
  };

  // ── Admin "viewing as role" banner ──
  if (isAdminViewingRolePage) {
    return (
      <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between text-sm sticky top-0 z-50 shadow-md" dir="rtl">
        <span className="flex items-center gap-2">
          <span className="text-slate-400">מנהל מערכת</span>
          <span className="text-slate-500">·</span>
          <span>צופה בדף: <strong>{pathname.replace('/', '')}</strong></span>
        </span>
        <button
          onClick={() => router.push('/admin')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-md font-semibold transition-colors"
        >
          ← חזרה לניהול
        </button>
      </div>
    );
  }

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">

          {/* Logo + Desktop Links */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => router.push(config.links[0].href)}
              className="flex items-center gap-2 pl-4 border-l border-gray-200 ml-3 hover:opacity-80 transition-opacity flex-shrink-0"
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                <img src={municipalityConfig.logo} alt="לוגו" className="w-full h-full object-contain" />
              </div>
              <span className="hidden sm:block font-bold text-gray-800 text-base leading-tight">
                {municipalityConfig.systemName}
              </span>
            </button>

            {/* Desktop nav links */}
            <div className="hidden lg:flex items-center gap-0.5">
              {config.links.map((link) => (
                <button
                  key={link.href}
                  onClick={() => router.push(link.href)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors border-b-2 ${
                    isActiveLink(link.href)
                      ? `${accent.active} border-current`
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-transparent'
                  }`}
                >
                  <span>{link.icon}</span>
                  <span>{link.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right side: badge + name + menu/logout */}
          <div className="flex items-center gap-2">
            <span className={`hidden md:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-white ${accent.badge}`}>
              {config.label}
            </span>
            <span className="hidden sm:block text-sm font-medium text-gray-800 truncate max-w-[120px]">
              {user?.fullName}
            </span>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100"
              aria-label="תפריט"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>

            {/* Desktop logout */}
            <button
              onClick={handleLogout}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              יציאה
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100 shadow-lg">
          <div className="px-3 pt-2 pb-3 space-y-0.5">

            {/* User info strip */}
            <div className="flex items-center justify-between px-3 py-2.5 mb-1 border-b border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-900">{user?.fullName}</p>
                <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-xs font-medium text-white ${accent.badge}`}>
                  {config.label}
                </span>
              </div>
              <img src={municipalityConfig.logo} alt="לוגו" className="w-8 h-8 object-contain opacity-60" />
            </div>

            {/* Links */}
            {config.links.map((link) => (
              <button
                key={link.href}
                onClick={() => { router.push(link.href); setMobileMenuOpen(false); }}
                className={`w-full text-right px-3 py-3 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors ${
                  isActiveLink(link.href)
                    ? accent.mobileActive
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-lg w-6 text-center">{link.icon}</span>
                <span className="flex-1">{link.label}</span>
                {isActiveLink(link.href) && (
                  <svg className="w-4 h-4 opacity-60" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}

            {/* Logout */}
            <div className="border-t border-gray-100 mt-2 pt-2">
              <button
                onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                className="w-full text-right px-3 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
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
