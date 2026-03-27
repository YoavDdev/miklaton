'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalShelters: 0,
    activeTasks: 0,
    pendingApprovals: 0,
    recentAlerts: 0
  });

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
      await loadStats(data.user.role);
    } catch (error) {
      console.error('Auth error:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async (role) => {
    // כאן נוסיף שאילתות לסטטיסטיקות אמיתיות
    // לעכשיו נציג נתונים דמה
    setStats({
      totalShelters: 150,
      activeTasks: 12,
      pendingApprovals: 5,
      recentAlerts: 3
    });
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
    const actions = {
      ceo: [
        { title: 'דוחות ותובנות', icon: '📊', link: '/ceo' },
        { title: 'רשימת צוותים', icon: '👥', link: '/ceo/teams' },
        { title: 'התראות חשובות', icon: '🚨', link: '/ceo/alerts' },
      ],
      call_center_manager: [
        { title: 'ניהול מוקדנים', icon: '📞', link: '/call-center-manager' },
        { title: 'דוחות ביצועים', icon: '📋', link: '/call-center-manager/reports' },
        { title: 'משימות פתוחות', icon: '🎯', link: '/call-center-manager/tasks' },
      ],
      sector_manager: [
        { title: 'ניהול כוננים', icon: '👷', link: '/sector-manager' },
        { title: 'סטטיסטיקות מכלול', icon: '📊', link: '/sector-manager/stats' },
        { title: 'משימות צוות', icon: '📝', link: '/sector-manager/tasks' },
      ],
      operator: [
        { title: 'קבלת פניות', icon: '📞', link: '/operator' },
        { title: 'המשימות שלי', icon: '📋', link: '/operator/tasks' },
        { title: 'חיפוש מקלט', icon: '🔍', link: '/operator/search' },
      ],
      inspector: [
        { title: 'המשימות שלי', icon: '📱', link: '/inspector' },
        { title: 'דיווח חדש', icon: '📸', link: '/inspector/report' },
        { title: 'מפת משימות', icon: '🗺️', link: '/inspector/map' },
      ],
      shelter_manager: [
        { title: 'המקלטים שלי', icon: '🏠', link: '/shelter-manager' },
        { title: 'משימות תחזוקה', icon: '🔧', link: '/shelter-manager/maintenance' },
        { title: 'דוחות ותמונות', icon: '📸', link: '/shelter-manager/reports' },
      ],
      admin: [
        { title: 'ניהול משתמשים', icon: '👥', link: '/admin/users' },
        { title: 'הגדרות מערכת', icon: '⚙️', link: '/admin/settings' },
        { title: 'Audit Log', icon: '📊', link: '/admin/audit' },
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
      
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">מקלטון - {getRoleDisplay(user?.role)}</h1>
              <p className="text-sm text-gray-600">שלום, {user?.full_name}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/profile')}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
              >
                👤 פרופיל
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
              >
                התנתק
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">סך מקלטים</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalShelters}</p>
              </div>
              <div className="text-4xl">🏠</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">משימות פעילות</p>
                <p className="text-3xl font-bold text-blue-600">{stats.activeTasks}</p>
              </div>
              <div className="text-4xl">📋</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ממתינים לאישור</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.pendingApprovals}</p>
              </div>
              <div className="text-4xl">⏳</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">התראות אחרונות</p>
                <p className="text-3xl font-bold text-red-600">{stats.recentAlerts}</p>
              </div>
              <div className="text-4xl">🚨</div>
            </div>
          </div>
        </div>

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
