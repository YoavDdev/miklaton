'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import ActiveEventBanner from '@/components/ActiveEventBanner';

export default function ShelterManagerPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('my-shelters');
  const [shelters, setShelters] = useState([]);
  const [maintenanceTasks, setMaintenanceTasks] = useState([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedShelter, setSelectedShelter] = useState(null);

  useEffect(() => {
    checkAuth();
    loadShelters();
    loadMaintenanceTasks();
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
      
      if (data.user.role !== 'shelter_manager' && data.user.role !== 'admin') {
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

  const loadShelters = async () => {
    // כאן נטען מקלטים אמיתיים מהטבלה
    // לעכשיו נתונים דמה
    setShelters([
      {
        id: 1,
        name: 'מקלט הרצל 12',
        address: 'הרצל 12, יהוד',
        capacity: 50,
        status: 'תקין',
        lastInspection: '15/03/2026',
        nextInspection: '15/06/2026',
        issues: 0
      },
      {
        id: 2,
        name: 'מקלט וייצמן 45',
        address: 'וייצמן 45, יהוד',
        capacity: 80,
        status: 'דורש תיקון',
        lastInspection: '10/03/2026',
        nextInspection: '10/04/2026',
        issues: 2
      },
      {
        id: 3,
        name: 'מקלט ביאלק 8',
        address: 'ביאלק 8, יהוד',
        capacity: 60,
        status: 'תקין',
        lastInspection: '20/03/2026',
        nextInspection: '20/06/2026',
        issues: 0
      },
      {
        id: 4,
        name: 'מקלט בן גוריון 23',
        address: 'בן גוריון 23, יהוד',
        capacity: 100,
        status: 'דורש תיקון',
        lastInspection: '05/03/2026',
        nextInspection: '05/04/2026',
        issues: 1
      }
    ]);
  };

  const loadMaintenanceTasks = async () => {
    // כאן נטען משימות תחזוקה אמיתיות
    setMaintenanceTasks([
      {
        id: 1,
        shelterId: 2,
        shelterName: 'מקלט וייצמן 45',
        task: 'תיקון דלת כניסה',
        priority: 'גבוה',
        status: 'בטיפול',
        assignedTo: 'משה כהן',
        dueDate: '28/03/2026'
      },
      {
        id: 2,
        shelterId: 4,
        shelterName: 'מקלט בן גוריון 23',
        task: 'החלפת תאורה',
        priority: 'בינוני',
        status: 'ממתין',
        assignedTo: 'דני לוי',
        dueDate: '30/03/2026'
      }
    ]);
  };

  const handleUpdateShelterStatus = async (shelterId, newStatus) => {
    // כאן נעדכן בטבלה
    toast.success(`סטטוס מקלט עודכן ל-${newStatus} ✅`);
    loadShelters();
  };

  const handleApproveTask = async (taskId) => {
    if (!confirm('האם לאשר את השלמת המשימה?')) return;
    
    // כאן נעדכן בטבלה
    toast.success('משימת תחזוקה אושרה! ✅');
    loadMaintenanceTasks();
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

  const totalShelters = shelters.length;
  const healthyShelters = shelters.filter(s => s.status === 'תקין').length;
  const needsRepair = shelters.filter(s => s.status === 'דורש תיקון').length;
  const openTasks = maintenanceTasks.filter(t => t.status !== 'הושלם').length;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Toaster position="top-center" />
      <ActiveEventBanner />
      
      {/* Quick Actions Bar */}
      <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex justify-end">
            <button
              onClick={() => router.push('/profile')}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-md font-medium transition-colors flex items-center gap-2"
            >
              👤 האיזור האישי
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">סך מקלטים</p>
                <p className="text-3xl font-bold text-gray-900">{totalShelters}</p>
              </div>
              <div className="text-4xl">🏠</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">תקינים</p>
                <p className="text-3xl font-bold text-green-600">{healthyShelters}</p>
              </div>
              <div className="text-4xl">✅</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">דורשים תיקון</p>
                <p className="text-3xl font-bold text-red-600">{needsRepair}</p>
              </div>
              <div className="text-4xl">🔧</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">משימות תחזוקה</p>
                <p className="text-3xl font-bold text-orange-600">{openTasks}</p>
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
                onClick={() => setActiveTab('my-shelters')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'my-shelters'
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🏠 המקלטים שלי
              </button>
              <button
                onClick={() => setActiveTab('maintenance')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'maintenance'
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🔧 משימות תחזוקה
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'reports'
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📸 דוחות ותמונות
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content - My Shelters */}
        {activeTab === 'my-shelters' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">המקלטים שאני אחראי עליהם</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">שם המקלט</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">כתובת</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">קיבולת</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">סטטוס</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">בעיות</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">בדיקה אחרונה</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">בדיקה הבאה</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">פעולות</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {shelters.map((shelter) => (
                    <tr key={shelter.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {shelter.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {shelter.address}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">
                        {shelter.capacity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          shelter.status === 'תקין' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {shelter.status === 'תקין' ? '✅ תקין' : '🔧 דורש תיקון'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        {shelter.issues > 0 ? (
                          <span className="font-bold text-red-600">{shelter.issues}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {shelter.lastInspection}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {shelter.nextInspection}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => {
                            setSelectedShelter(shelter);
                            setShowDetailModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 font-medium"
                        >
                          👁️ פרטים
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content - Maintenance Tasks */}
        {activeTab === 'maintenance' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">משימות תחזוקה פתוחות</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">מקלט</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">משימה</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">מבצע</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">עדיפות</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">סטטוס</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">תאריך יעד</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">פעולות</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {maintenanceTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {task.shelterName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {task.task}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {task.assignedTo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          task.priority === 'גבוה' ? 'bg-red-100 text-red-800' :
                          task.priority === 'בינוני' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          task.status === 'הושלם' ? 'bg-green-100 text-green-800' :
                          task.status === 'בטיפול' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {task.dueDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {task.status === 'בטיפול' && (
                          <button
                            onClick={() => handleApproveTask(task.id)}
                            className="text-green-600 hover:text-green-900 font-medium"
                          >
                            ✅ אשר סיום
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {maintenanceTasks.length === 0 && (
                <div className="p-12 text-center">
                  <div className="text-6xl mb-4">🎉</div>
                  <p className="text-xl font-bold text-gray-900 mb-2">אין משימות תחזוקה פתוחות!</p>
                  <p className="text-gray-600">כל המקלטים במצב מעולה.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content - Reports */}
        {activeTab === 'reports' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">דוחות ותמונות</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
                <h3 className="text-lg font-bold text-green-900 mb-3">📊 דוח בדיקות</h3>
                <p className="text-sm text-green-700 mb-4">
                  סיכום כל הבדיקות שבוצעו במקלטים
                </p>
                <button className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium">
                  📥 הורד דוח
                </button>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
                <h3 className="text-lg font-bold text-blue-900 mb-3">📸 גלריית תמונות</h3>
                <p className="text-sm text-blue-700 mb-4">
                  תמונות מכל המקלטים והבדיקות
                </p>
                <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">
                  🖼️ צפה בתמונות
                </button>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
                <h3 className="text-lg font-bold text-purple-900 mb-3">📋 מסמכים</h3>
                <p className="text-sm text-purple-700 mb-4">
                  תעודות, אישורים ומסמכים רשמיים
                </p>
                <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium">
                  📄 צפה במסמכים
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Shelter Detail Modal */}
      {showDetailModal && selectedShelter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-gray-900">{selectedShelter.name}</h3>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedShelter(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-green-700"><strong>כתובת:</strong></p>
                    <p className="text-green-900">{selectedShelter.address}</p>
                  </div>
                  <div>
                    <p className="text-green-700"><strong>קיבולת:</strong></p>
                    <p className="text-green-900">{selectedShelter.capacity} איש</p>
                  </div>
                  <div>
                    <p className="text-green-700"><strong>סטטוס:</strong></p>
                    <p className="text-green-900">{selectedShelter.status}</p>
                  </div>
                  <div>
                    <p className="text-green-700"><strong>בעיות פתוחות:</strong></p>
                    <p className="text-green-900">{selectedShelter.issues}</p>
                  </div>
                  <div>
                    <p className="text-green-700"><strong>בדיקה אחרונה:</strong></p>
                    <p className="text-green-900">{selectedShelter.lastInspection}</p>
                  </div>
                  <div>
                    <p className="text-green-700"><strong>בדיקה הבאה:</strong></p>
                    <p className="text-green-900">{selectedShelter.nextInspection}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  עדכון סטטוס מקלט
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleUpdateShelterStatus(selectedShelter.id, 'תקין')}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
                  >
                    ✅ סמן כתקין
                  </button>
                  <button
                    onClick={() => handleUpdateShelterStatus(selectedShelter.id, 'דורש תיקון')}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
                  >
                    🔧 דורש תיקון
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedShelter(null);
                }}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
