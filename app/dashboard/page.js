'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // ריק עד שמגיעים נתונים אמיתיים. אפסים היו נראים כמו נתון ולא כמו היעדרו.
  const [stats, setStats] = useState({});

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include'
      });

      if (!res.ok) {
        router.push('/login');
        return;
      }

      const data = await res.json();
      setUser(data.user);
      
      // טעינת סטטיסטיקות לפי תפקיד
      await loadStats();
    } catch (error) {
      console.error('Auth error:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch('/api/dashboard/stats', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      router.push('/login');
    } catch (error) {
      toast.error('שגיאה בהתנתקות');
    }
  };

  const getRoleDisplay = (role) => {
    const roles = {
      ceo: 'מנכ"ל עיריה',
      call_center_manager: 'מנהלת מוקד עירוני',
      sector_manager: 'מנהל מכלול',
      operator: 'מוקדן',
      inspector: 'פקח/שיטור עירוני',
      shelter_manager: 'אחראי מקלטים',
      admin: 'אדמין'
    };
    return roles[role] || role;
  };

  const getQuickActions = (role) => {
    // רק נתיבים שקיימים בפועל. קודם 13 מהם הובילו ל-404 (YOA-24).
    const actions = {
      ceo: [
        { title: 'דוחות ותובנות', icon: '📊', link: '/ceo' },
        { title: 'אירועים', icon: '🚨', link: '/events' },
      ],
      call_center_manager: [
        { title: 'ניהול מוקד', icon: '📞', link: '/call-center-manager' },
        { title: 'עמדת מוקדן', icon: '🎧', link: '/operator' },
        { title: 'אירועים', icon: '🚨', link: '/events' },
      ],
      sector_manager: [
        { title: 'ניהול המכלול', icon: '👷', link: '/sector-manager' },
        { title: 'ספר טלפונים', icon: '📕', link: '/on-call' },
        { title: 'אירועים', icon: '🚨', link: '/events' },
      ],
      operator: [
        { title: 'קבלת פניות', icon: '📞', link: '/operator' },
        { title: 'המשימות שלי', icon: '📋', link: '/operator/tasks' },
        { title: 'מדריך שיחות', icon: '📖', link: '/operator/call-guide' },
      ],
      inspector: [
        { title: 'סיור פיקוח', icon: '📱', link: '/inspection' },
        { title: 'אירועים', icon: '🚨', link: '/events' },
      ],
      shelter_manager: [
        { title: 'המקלטים שלי', icon: '🏠', link: '/shelter-manager' },
        { title: 'אירועים', icon: '🚨', link: '/events' },
      ],
      admin: [
        { title: 'ניהול משתמשים', icon: '👥', link: '/admin/users' },
        { title: 'ניהול מכלולים', icon: '🏢', link: '/admin/departments' },
        { title: 'לוח פינוי אשפה', icon: '🗑️', link: '/admin/garbage-schedule' },
      ],
    };
    return actions[role] || [];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Toaster position="top-center" />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Stats Cards - מוצגים רק כשיש נתון אמיתי (YOA-24) */}
        {(() => {
          const cards = [
            { key: 'totalShelters', label: 'מקלטים', icon: '🏠', color: 'text-gray-900' },
            { key: 'pendingTasks', label: 'משימות ממתינות', icon: '📋', color: 'text-blue-600' },
            { key: 'pendingApprovals', label: 'ממתינים לאישור', icon: '⏳', color: 'text-yellow-600' },
            { key: 'activeNotifications', label: 'הודעות פעילות', icon: '📢', color: 'text-red-600' },
          ].filter((c) => typeof stats[c.key] === 'number');

          if (cards.length === 0) return null;

          return (
            <div className={`grid grid-cols-1 md:grid-cols-${Math.min(cards.length, 4)} gap-6 mb-8`}>
              {cards.map((card) => (
                <div key={card.key} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">{card.label}</p>
                      <p className={`text-3xl font-bold ${card.color}`}>{stats[card.key]}</p>
                    </div>
                    <div className="text-4xl">{card.icon}</div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">פעולות מהירות</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {getQuickActions(user?.role).map((action, index) => (
              <button
                key={index}
                onClick={() => router.push(action.link)}
                className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-right"
              >
                <span className="text-3xl">{action.icon}</span>
                <span className="font-medium text-gray-900">{action.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">פעילות אחרונה</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
              <span className="text-2xl">ℹ️</span>
              <div>
                <p className="font-medium text-gray-900">עדכון מערכת</p>
                <p className="text-sm text-gray-600">המערכת עודכנה ל-7 תפקידים חדשים</p>
                <p className="text-xs text-gray-500">לפני 5 דקות</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-medium text-gray-900">משימה הושלמה</p>
                <p className="text-sm text-gray-600">בדיקת מקלט ברחוב הרצל 45</p>
                <p className="text-xs text-gray-500">לפני 2 שעות</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-medium text-gray-900">התראה חדשה</p>
                <p className="text-sm text-gray-600">נדרשת תחזוקה במקלט ברחוב וייצמן 12</p>
                <p className="text-xs text-gray-500">לפני 3 שעות</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
