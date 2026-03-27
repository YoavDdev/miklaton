'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

export default function InspectorPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('my-tasks');
  const [myTasks, setMyTasks] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState({
    title: '',
    description: '',
    location: '',
    priority: 'בינוני',
    images: []
  });

  useEffect(() => {
    checkAuth();
    loadMyTasks();
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
      
      if (data.user.role !== 'inspector' && data.user.role !== 'admin') {
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

  const loadMyTasks = async () => {
    // כאן נטען משימות אמיתיות מהטבלה
    // לעכשיו נתונים דמה
    setMyTasks([
      {
        id: 1,
        title: 'בדיקת מקלט ברחוב הרצל 12',
        location: 'הרצל 12, יהוד',
        priority: 'גבוה',
        status: 'בטיפול',
        assignedAt: '26/03/2026 09:00',
        dueDate: '26/03/2026 17:00'
      },
      {
        id: 2,
        title: 'תיקון דלת מקלט ברחוב וייצמן 45',
        location: 'וייצמן 45, יהוד',
        priority: 'בינוני',
        status: 'חדש',
        assignedAt: '26/03/2026 10:30',
        dueDate: '27/03/2026 12:00'
      },
      {
        id: 3,
        title: 'סריקת מקלטים ברחוב ביאלק',
        location: 'ביאלק 1-20, יהוד',
        priority: 'נמוך',
        status: 'חדש',
        assignedAt: '26/03/2026 11:00',
        dueDate: '28/03/2026 16:00'
      }
    ]);
  };

  const handleCompleteTask = async (taskId) => {
    if (!confirm('האם לסמן משימה זו כהושלמה?')) return;
    
    // כאן נעדכן את הסטטוס בטבלה
    toast.success('משימה הושלמה! ✅');
    loadMyTasks();
  };

  const handleSubmitReport = async () => {
    if (!reportData.title || !reportData.location) {
      toast.error('נא למלא כותרת ומיקום');
      return;
    }

    // כאן נשמור את הדיווח בטבלה
    toast.success('דיווח נשלח בהצלחה! 📸');
    setShowReportModal(false);
    setReportData({
      title: '',
      description: '',
      location: '',
      priority: 'בינוני',
      images: []
    });
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    toast.success(`${files.length} תמונות נבחרו 📷`);
    // כאן נטפל בהעלאת תמונות
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

  const tasksNew = myTasks.filter(t => t.status === 'חדש').length;
  const tasksInProgress = myTasks.filter(t => t.status === 'בטיפול').length;
  const tasksCompleted = myTasks.filter(t => t.status === 'הושלם').length;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">🚨 פקח/שיטור עירוני</h1>
              <p className="text-sm text-orange-100">שלום, {user?.full_name}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/profile')}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md font-medium transition-colors flex items-center gap-2"
              >
                👤 האיזור האישי
              </button>
              <button
                onClick={() => setShowReportModal(true)}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-md font-medium transition-colors flex items-center gap-2"
              >
                📸 דיווח חדש
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-md font-medium transition-colors"
              >
                🏠 דף הבית
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-700 text-white rounded-md hover:bg-red-800 font-medium"
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
                <p className="text-sm text-gray-600">משימות חדשות</p>
                <p className="text-3xl font-bold text-blue-600">{tasksNew}</p>
              </div>
              <div className="text-4xl">🆕</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">בטיפול</p>
                <p className="text-3xl font-bold text-orange-600">{tasksInProgress}</p>
              </div>
              <div className="text-4xl">⚙️</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">הושלמו</p>
                <p className="text-3xl font-bold text-green-600">{tasksCompleted}</p>
              </div>
              <div className="text-4xl">✅</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">סך הכל</p>
                <p className="text-3xl font-bold text-gray-900">{myTasks.length}</p>
              </div>
              <div className="text-4xl">📋</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('my-tasks')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'my-tasks'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📋 המשימות שלי
              </button>
              <button
                onClick={() => setActiveTab('map')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'map'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🗺️ מפת משימות
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'reports'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📸 הדיווחים שלי
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content - My Tasks */}
        {activeTab === 'my-tasks' && (
          <div className="space-y-4">
            {myTasks.map((task) => (
              <div key={task.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{task.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        task.priority === 'דחוף' ? 'bg-red-100 text-red-800' :
                        task.priority === 'גבוה' ? 'bg-orange-100 text-orange-800' :
                        task.priority === 'בינוני' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {task.priority}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        task.status === 'הושלם' ? 'bg-green-100 text-green-800' :
                        task.status === 'בטיפול' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {task.status}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-2">
                      📍 <strong>מיקום:</strong> {task.location}
                    </p>
                    <p className="text-sm text-gray-600 mb-2">
                      🕐 <strong>הוקצה:</strong> {task.assignedAt}
                    </p>
                    <p className="text-sm text-gray-600">
                      ⏰ <strong>תאריך יעד:</strong> {task.dueDate}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.location)}`, '_blank')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium text-sm"
                    >
                      🗺️ נווט
                    </button>
                    {task.status !== 'הושלם' && (
                      <button
                        onClick={() => handleCompleteTask(task.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium text-sm"
                      >
                        ✅ סיים
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {myTasks.length === 0 && (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <div className="text-6xl mb-4">🎉</div>
                <p className="text-xl font-bold text-gray-900 mb-2">אין משימות פתוחות!</p>
                <p className="text-gray-600">כל הכבוד, סיימת את כל המשימות שלך.</p>
              </div>
            )}
          </div>
        )}

        {/* Tab Content - Map */}
        {activeTab === 'map' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">מפת משימות</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
              <div className="text-6xl mb-4">🗺️</div>
              <p className="text-blue-800 font-medium mb-2">
                מפת משימות אינטראקטיבית
              </p>
              <p className="text-sm text-blue-600">
                כאן תוצג מפה עם כל המשימות שלך מסומנות לפי מיקום ועדיפות
              </p>
            </div>
          </div>
        )}

        {/* Tab Content - My Reports */}
        {activeTab === 'reports' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">הדיווחים שלי</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <div className="text-6xl mb-4">📸</div>
              <p className="text-gray-800 font-medium mb-2">
                אין דיווחים עדיין
              </p>
              <p className="text-sm text-gray-600 mb-4">
                דיווחים שתשלח יופיעו כאן
              </p>
              <button
                onClick={() => setShowReportModal(true)}
                className="px-6 py-3 bg-orange-600 text-white rounded-md hover:bg-orange-700 font-medium"
              >
                📸 צור דיווח ראשון
              </button>
            </div>
          </div>
        )}
      </main>

      {/* New Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-gray-900">📸 דיווח חדש</h3>
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportData({
                    title: '',
                    description: '',
                    location: '',
                    priority: 'בינוני',
                    images: []
                  });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  כותרת *
                </label>
                <input
                  type="text"
                  value={reportData.title}
                  onChange={(e) => setReportData({...reportData, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                  placeholder="למשל: דלת מקלט שבורה"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  מיקום *
                </label>
                <input
                  type="text"
                  value={reportData.location}
                  onChange={(e) => setReportData({...reportData, location: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                  placeholder="למשל: הרצל 12, יהוד"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  עדיפות
                </label>
                <select
                  value={reportData.priority}
                  onChange={(e) => setReportData({...reportData, priority: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="נמוך">נמוך</option>
                  <option value="בינוני">בינוני</option>
                  <option value="גבוה">גבוה</option>
                  <option value="דחוף">דחוף</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  תיאור
                </label>
                <textarea
                  value={reportData.description}
                  onChange={(e) => setReportData({...reportData, description: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                  placeholder="תאר את הבעיה..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  תמונות
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  ניתן להעלות מספר תמונות
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSubmitReport}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 font-medium"
                >
                  📤 שלח דיווח
                </button>
                <button
                  onClick={() => {
                    setShowReportModal(false);
                    setReportData({
                      title: '',
                      description: '',
                      location: '',
                      priority: 'בינוני',
                      images: []
                    });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
