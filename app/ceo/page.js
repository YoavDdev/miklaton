'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import ActiveEventBanner from '@/components/ActiveEventBanner';

export default function CEOPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [systemStats, setSystemStats] = useState({});
  const [teams, setTeams] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    checkAuth();
    loadSystemStats();
    loadTeams();
    loadAlerts();
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
      
      if (data.user.role !== 'ceo' && data.user.role !== 'admin') {
        router.push('/dashboard');
        return;
      }

      setUser(data.user);
    } catch (error) {
      console.error('Auth error:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const loadSystemStats = async () => {
    // כאן נטען סטטיסטיקות אמיתיות מכל הטבלאות
    // לעכשיו נתונים דמה
    setSystemStats({
      totalShelters: 150,
      totalUsers: 45,
      activeTasks: 23,
      completedToday: 12,
      pendingApprovals: 5,
      systemHealth: 98,
      activeOperators: 8,
      openIncidents: 2
    });
  };

  const loadTeams = async () => {
    // כאן נטען צוותים אמיתיים
    setTeams([
      {
        id: 1,
        name: 'מוקד עירוני',
        manager: 'שרה לוי',
        members: 12,
        status: 'פעיל',
        performance: 95
      },
      {
        id: 2,
        name: 'מכלול חשמל',
        manager: 'משה כהן',
        members: 8,
        status: 'פעיל',
        performance: 88
      },
      {
        id: 3,
        name: 'מכלול מים',
        manager: 'דני אברהם',
        members: 6,
        status: 'פעיל',
        performance: 92
      },
      {
        id: 4,
        name: 'פקחים',
        manager: 'רונית ברק',
        members: 10,
        status: 'פעיל',
        performance: 90
      },
      {
        id: 5,
        name: 'אחראי מקלטים',
        manager: 'יוסי דוד',
        members: 4,
        status: 'פעיל',
        performance: 96
      }
    ]);
  };

  const loadAlerts = async () => {
    // כאן נטען התראות אמיתיות
    setAlerts([
      {
        id: 1,
        type: 'critical',
        title: 'דורש אישור דחוף',
        message: 'תיקון מקלט ברחוב הרצל דורש אישור תקציבי',
        time: '5 דקות',
        actionRequired: true
      },
      {
        id: 2,
        type: 'warning',
        title: 'ביצועים נמוכים',
        message: 'מכלול חשמל - ביצועים מתחת ל-90% השבוע',
        time: '2 שעות',
        actionRequired: false
      },
      {
        id: 3,
        type: 'info',
        title: 'דוח שבועי מוכן',
        message: 'דוח סיכום פעילות השבוע זמין לצפייה',
        time: '4 שעות',
        actionRequired: false
      }
    ]);
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
      <ActiveEventBanner />
      
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-700 to-purple-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">👔 דשבורד מנכ"ל - מקלטון</h1>
              <p className="text-sm text-indigo-100">שלום, {user?.full_name}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/profile')}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md font-medium transition-colors flex items-center gap-2"
              >
                👤 האיזור האישי
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-md font-medium transition-colors"
              >
                🏠 דף הבית
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
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">בריאות המערכת</p>
                <p className="text-3xl font-bold text-green-600">{systemStats.systemHealth}%</p>
              </div>
              <div className="text-4xl">💚</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">סך מקלטים</p>
                <p className="text-3xl font-bold text-blue-600">{systemStats.totalShelters}</p>
              </div>
              <div className="text-4xl">🏠</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">משתמשים במערכת</p>
                <p className="text-3xl font-bold text-purple-600">{systemStats.totalUsers}</p>
              </div>
              <div className="text-4xl">👥</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">משימות פעילות</p>
                <p className="text-3xl font-bold text-orange-600">{systemStats.activeTasks}</p>
              </div>
              <div className="text-4xl">📋</div>
            </div>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow p-4 border border-green-200">
            <p className="text-sm text-green-700 mb-1">הושלמו היום</p>
            <p className="text-2xl font-bold text-green-900">{systemStats.completedToday}</p>
          </div>
          
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg shadow p-4 border border-yellow-200">
            <p className="text-sm text-yellow-700 mb-1">ממתינים לאישור</p>
            <p className="text-2xl font-bold text-yellow-900">{systemStats.pendingApprovals}</p>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow p-4 border border-blue-200">
            <p className="text-sm text-blue-700 mb-1">מוקדנים פעילים</p>
            <p className="text-2xl font-bold text-blue-900">{systemStats.activeOperators}</p>
          </div>
          
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg shadow p-4 border border-red-200">
            <p className="text-sm text-red-700 mb-1">אירועים פתוחים</p>
            <p className="text-2xl font-bold text-red-900">{systemStats.openIncidents}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'overview'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📊 סקירה כללית
              </button>
              <button
                onClick={() => setActiveTab('teams')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'teams'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                👥 צוותים
              </button>
              <button
                onClick={() => setActiveTab('alerts')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'alerts'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🚨 התראות ({alerts.filter(a => a.actionRequired).length})
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'reports'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📈 דוחות ותובנות
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content - Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">📈 ביצועים שבועיים</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600">משימות הושלמו</span>
                    <span className="text-sm font-bold text-gray-900">85/100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: '85%' }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600">זמן תגובה ממוצע</span>
                    <span className="text-sm font-bold text-gray-900">2.5 דקות</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '90%' }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600">שביעות רצון תושבים</span>
                    <span className="text-sm font-bold text-gray-900">94%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-600 h-2 rounded-full" style={{ width: '94%' }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">🎯 יעדים חודשיים</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">✅</span>
                    <div>
                      <p className="font-medium text-gray-900">בדיקת כל המקלטים</p>
                      <p className="text-xs text-gray-600">הושלם 150/150</p>
                    </div>
                  </div>
                  <span className="text-green-600 font-bold">100%</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚙️</span>
                    <div>
                      <p className="font-medium text-gray-900">שדרוג מערכות</p>
                      <p className="text-xs text-gray-600">בתהליך 6/10</p>
                    </div>
                  </div>
                  <span className="text-blue-600 font-bold">60%</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">👥</span>
                    <div>
                      <p className="font-medium text-gray-900">הכשרת צוות</p>
                      <p className="text-xs text-gray-600">בתהליך 30/45</p>
                    </div>
                  </div>
                  <span className="text-yellow-600 font-bold">67%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content - Teams */}
        {activeTab === 'teams' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">סטטוס צוותים</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">צוות</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">מנהל</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">חברי צוות</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">סטטוס</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">ביצועים</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {teams.map((team) => (
                    <tr key={team.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {team.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {team.manager}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">
                        {team.members}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {team.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                team.performance >= 90 ? 'bg-green-600' :
                                team.performance >= 80 ? 'bg-blue-600' :
                                'bg-yellow-600'
                              }`}
                              style={{ width: `${team.performance}%` }}
                            ></div>
                          </div>
                          <span className="font-bold text-gray-900 min-w-[3rem]">{team.performance}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content - Alerts */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div 
                key={alert.id}
                className={`bg-white rounded-lg shadow p-6 border-r-4 ${
                  alert.type === 'critical' ? 'border-red-500' :
                  alert.type === 'warning' ? 'border-yellow-500' :
                  'border-blue-500'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">
                        {alert.type === 'critical' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️'}
                      </span>
                      <h3 className="text-lg font-bold text-gray-900">{alert.title}</h3>
                      {alert.actionRequired && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full">
                          דורש טיפול
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 mb-2">{alert.message}</p>
                    <p className="text-sm text-gray-500">לפני {alert.time}</p>
                  </div>
                  {alert.actionRequired && (
                    <button
                      onClick={() => toast.success('פעולה בוצעה!')}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
                    >
                      טפל עכשיו
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab Content - Reports */}
        {activeTab === 'reports' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">📊 דוחות זמינים</h3>
              <div className="space-y-3">
                <button className="w-full text-right p-4 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
                  <p className="font-medium text-indigo-900">דוח שבועי - פעילות מערכת</p>
                  <p className="text-sm text-indigo-600">עודכן לאחרונה: היום 08:00</p>
                </button>
                <button className="w-full text-right p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
                  <p className="font-medium text-purple-900">דוח חודשי - ביצועי צוותים</p>
                  <p className="text-sm text-purple-600">עודכן לאחרונה: אתמול</p>
                </button>
                <button className="w-full text-right p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                  <p className="font-medium text-blue-900">דוח תקציבי - השקעות ותחזוקה</p>
                  <p className="text-sm text-blue-600">עודכן לאחרונה: לפני 3 ימים</p>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">💡 תובנות והמלצות</h3>
              <div className="space-y-3">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm font-medium text-green-900">✅ ביצועים מעולים</p>
                  <p className="text-xs text-green-700 mt-1">
                    צוות אחראי המקלטים עם ביצועים של 96% - חריג לטובה!
                  </p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-sm font-medium text-yellow-900">⚠️ שיפור נדרש</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    מכלול חשמל - מומלץ להגדיל משאבים או הכשרה נוספת
                  </p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm font-medium text-blue-900">💡 המלצה</p>
                  <p className="text-xs text-blue-700 mt-1">
                    שקול להגדיל תקציב תחזוקה למקלטים ב-15% לשנה הבאה
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
