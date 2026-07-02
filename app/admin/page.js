'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { municipalityConfig } from '@/lib/municipality';

const ROLE_VIEWS = [
  { href: '/operator', label: 'מוקדן', icon: '🎧', color: 'bg-cyan-500 hover:bg-cyan-600', desc: 'מסך עבודה יומיומי' },
  { href: '/call-center-manager', label: 'מנהל מוקד', icon: '📞', color: 'bg-blue-500 hover:bg-blue-600', desc: 'ניהול מוקדנים ומשימות' },
  { href: '/sector-manager', label: 'מנהל מכלול', icon: '🏢', color: 'bg-green-500 hover:bg-green-600', desc: 'ניהול כוננויות מכלול' },
  { href: '/inspector', label: 'פקח', icon: '🔍', color: 'bg-orange-500 hover:bg-orange-600', desc: 'משימות ודיווחי שטח' },
  { href: '/shelter-manager', label: 'מנהל מקלטים', icon: '🏠', color: 'bg-teal-500 hover:bg-teal-600', desc: 'ניהול מקלטים ציבוריים' },
  { href: '/ceo', label: 'מנכ"ל', icon: '🎯', color: 'bg-purple-500 hover:bg-purple-600', desc: 'סקירה כללית ודוחות' },
];

export default function AdminPage() {
  const router = useRouter();
  const [warMode, setWarMode] = useState(null);
  const [warModeLoading, setWarModeLoading] = useState(true);
  const [adminName, setAdminName] = useState('מנהל מערכת');
  const [stats, setStats] = useState({ total: null, pending: null, active: null });

  useEffect(() => {
    fetchWarMode();
    fetchStats();
    setAdminName(localStorage.getItem('full_name') || 'מנהל מערכת');
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) return;
      const data = await res.json();
      const users = data.users || [];
      setStats({
        total: users.length,
        pending: users.filter(u => u.status === 'pending').length,
        active: users.filter(u => u.status === 'active').length,
      });
    } catch {}
  };

  const fetchWarMode = async () => {
    try {
      const res = await fetch('/api/war-mode');
      const data = await res.json();
      if (data.success) {
        setWarMode(data.data?.is_active || false);
      }
    } catch (error) {
      console.error('Failed to fetch war mode:', error);
    } finally {
      setWarModeLoading(false);
    }
  };

  const toggleWarMode = async () => {
    const username = localStorage.getItem('username') || 'מנהל';
    const newMode = !warMode;
    
    try {
      const res = await fetch('/api/war-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: newMode,
          activated_by: username,
          notes: newMode ? 'הופעל מעמוד ניהול' : null
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setWarMode(newMode);
      }
    } catch (error) {
      console.error('Failed to toggle war mode:', error);
      alert('שגיאה בעדכון מצב חירום');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">

      {/* ── Header ── */}
      <header className="bg-gradient-to-l from-slate-800 to-slate-900 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">

            {/* Logo + Title */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden shadow-lg flex-shrink-0 bg-white/10 flex items-center justify-center">
                <img src={municipalityConfig.logo} alt="לוגו" className="w-full h-full object-contain p-0.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-lg sm:text-xl leading-tight">{municipalityConfig.systemName}</span>
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">מנהל מערכת</span>
                </div>
                <p className="text-slate-400 text-xs sm:text-sm truncate">{municipalityConfig.name} · {adminName}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={toggleWarMode}
                disabled={warModeLoading}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-all border-2 ${
                  warMode
                    ? 'bg-red-600 hover:bg-red-700 border-red-400 animate-pulse'
                    : 'bg-white/10 hover:bg-white/20 border-white/20'
                }`}
              >
                {warMode ? '🚨' : '⚪'} <span className="hidden sm:inline">{warMode ? 'מצב חירום' : 'מצב רגיל'}</span>
              </button>
              <button
                onClick={() => router.push('/admin/departments')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
              >
                🏢 <span className="hidden sm:inline">מכלולים</span>
              </button>
              <button
                onClick={() => router.push('/admin/users')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
              >
                👥 <span className="hidden sm:inline">ניהול משתמשים</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── War Mode Banner ── */}
      {warMode && (
        <div className="bg-red-600 text-white text-center py-2 px-4 text-sm font-bold">
          🚨 מצב חירום פעיל – שלבי מקלטים והתקשרויות ידלגו אוטומטית
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Pending approval */}
          <button
            onClick={() => router.push('/admin/users?filter=pending')}
            className={`rounded-xl p-5 text-right shadow-sm border-2 transition-all hover:shadow-md active:scale-95 ${
              stats.pending > 0
                ? 'bg-red-50 border-red-300 hover:bg-red-100'
                : 'bg-white border-gray-100 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-3xl font-bold ${stats.pending > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {stats.pending === null ? '...' : stats.pending}
              </span>
              <span className="text-2xl">{stats.pending > 0 ? '🔴' : '✅'}</span>
            </div>
            <p className={`text-sm font-semibold ${stats.pending > 0 ? 'text-red-700' : 'text-gray-500'}`}>
              ממתינים לאישור
            </p>
            {stats.pending > 0 && (
              <p className="text-xs text-red-500 mt-1">לחץ לאישור →</p>
            )}
          </button>

          {/* Active users */}
          <div className="bg-white border-2 border-gray-100 rounded-xl p-5 text-right shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl font-bold text-green-600">
                {stats.active === null ? '...' : stats.active}
              </span>
              <span className="text-2xl">👥</span>
            </div>
            <p className="text-sm font-semibold text-gray-600">משתמשים פעילים</p>
          </div>

          {/* System status */}
          <div className={`rounded-xl p-5 text-right shadow-sm border-2 ${
            warMode ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-lg font-bold ${warMode ? 'text-red-700' : 'text-green-700'}`}>
                {warMode ? 'מצב חירום' : 'תקין'}
              </span>
              <span className="text-2xl">{warMode ? '🚨' : '🟢'}</span>
            </div>
            <p className="text-sm font-semibold text-gray-600">סטטוס מערכת</p>
            <p className="text-xs text-gray-400 mt-1">
              {warMode ? 'מצב חירום פעיל' : 'כל המערכות פועלות'}
            </p>
          </div>
        </div>

        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">⚡ כניסה מהירה לפי תפקיד</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {ROLE_VIEWS.map((role) => (
            <button
              key={role.href}
              onClick={() => router.push(role.href)}
              className={`${role.color} text-white rounded-xl p-3 sm:p-4 text-center transition-all active:scale-95 shadow-md hover:shadow-lg`}
            >
              <div className="text-2xl sm:text-3xl mb-1">{role.icon}</div>
              <div className="text-sm font-bold leading-tight">{role.label}</div>
              <div className="text-xs opacity-80 mt-0.5 hidden sm:block leading-tight">{role.desc}</div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
