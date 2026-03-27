'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import OnCallManagerNew from '@/components/OnCallManagerNew';

export default function CallCenterManagerPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('operators');
  const [operators, setOperators] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [newTask, setNewTask] = useState({ title: '', description: '', assigned_to: '', priority: 'בינוני', due_date: '' });

  useEffect(() => {
    checkAuth();
    loadData();
    const interval = setInterval(loadSessions, 10000); // רענון כל 10 שניות
    return () => clearInterval(interval);
  }, []);

  const loadData = () => {
    loadSessions();
    loadTasks();
    loadAllUsers();
  };

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
      
      if (data.user.role !== 'call_center_manager' && data.user.role !== 'admin') {
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

  const loadSessions = async () => {
    try {
      const res = await fetch('/api/operator/sessions', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        
        // המר סשנים למוקדנים עם סטטיסטיקות
        const operatorsData = (data.sessions || []).map(session => {
          const userTasks = tasks.filter(t => t.assigned_to === session.user_id);
          const tasksOpen = userTasks.filter(t => t.status !== 'הושלם').length;
          const tasksCompleted = userTasks.filter(t => t.status === 'הושלם').length;
          
          const lastActivity = new Date(session.last_activity);
          const minutesAgo = Math.floor((Date.now() - lastActivity) / 60000);
          const lastActiveText = minutesAgo < 1 ? 'עכשיו' : minutesAgo < 60 ? `${minutesAgo} דק'` : `${Math.floor(minutesAgo / 60)} שעות`;
          
          return {
            id: session.user_id,
            full_name: session.user?.full_name || 'לא ידוע',
            role: session.user?.role || '',
            status: 'פעיל',
            tasksOpen,
            tasksCompleted,
            lastActive: lastActiveText
          };
        });
        setOperators(operatorsData);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const loadAllUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadTasks = async () => {
    try {
      const res = await fetch('/api/operator/tasks', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };


  const handleSendMessage = async () => {
    if (!messageText.trim()) {
      toast.error('נא להזין הודעה');
      return;
    }
    
    try {
      const res = await fetch('/api/operator/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message_text: messageText,
          target_role: 'operator',
          is_urgent: false
        })
      });

      if (res.ok) {
        toast.success('הודעה נשלחה לכל המוקדנים! 📢');
        setShowMessageModal(false);
        setMessageText('');
      } else {
        toast.error('שגיאה בשליחת הודעה');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('שגיאה בשליחת הודעה');
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title || !newTask.assigned_to) {
      toast.error('נא למלא שם משימה ולבחור מוקדן');
      return;
    }

    try {
      const res = await fetch('/api/operator/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newTask)
      });

      if (res.ok) {
        toast.success('משימה נוצרה בהצלחה! ✅');
        setShowTaskModal(false);
        setNewTask({ title: '', description: '', assigned_to: '', priority: 'בינוני', due_date: '' });
        loadTasks();
      } else {
        toast.error('שגיאה ביצירת משימה');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('שגיאה ביצירת משימה');
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

  const activeOperators = operators.filter(op => op.status === 'פעיל').length;
  const totalTasksOpen = tasks.filter(t => t.status !== 'הושלם').length;
  const totalTasksCompleted = tasks.filter(t => t.status === 'הושלם').length;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">מוקד עירוני - מנהלת מוקד</h1>
              <p className="text-sm text-pink-100">שלום, {user?.full_name}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/profile')}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md font-medium transition-colors flex items-center gap-2"
              >
                👤 האיזור האישי
              </button>
              <button
                onClick={() => setShowMessageModal(true)}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 rounded-md font-medium transition-colors flex items-center gap-2"
              >
                📢 שלח הודעה
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
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">מוקדנים פעילים</p>
                <p className="text-3xl font-bold text-green-600">{activeOperators}</p>
              </div>
              <div className="text-4xl">📞</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">סך מוקדנים</p>
                <p className="text-3xl font-bold text-blue-600">{operators.length}</p>
              </div>
              <div className="text-4xl">👥</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">משימות פתוחות</p>
                <p className="text-3xl font-bold text-yellow-600">{totalTasksOpen}</p>
              </div>
              <div className="text-4xl">📋</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">הושלמו היום</p>
                <p className="text-3xl font-bold text-green-600">{totalTasksCompleted}</p>
              </div>
              <div className="text-4xl">✅</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('operators')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'operators'
                    ? 'border-pink-600 text-pink-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📞 מוקדנים
              </button>
              <button
                onClick={() => setActiveTab('tasks')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'tasks'
                    ? 'border-pink-600 text-pink-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📋 משימות פתוחות
              </button>
              <button
                onClick={() => setActiveTab('shifts')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'shifts'
                    ? 'border-pink-600 text-pink-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🕐 משמרות כוננים
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'reports'
                    ? 'border-pink-600 text-pink-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📊 דוחות ביצועים
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content - Operators */}
        {activeTab === 'operators' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">מוקדנים מחוברים כרגע</h2>
              <span className="text-sm text-gray-500">{operators.length} מוקדנים פעילים</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">שם מלא</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">תפקיד</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">סטטוס</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">משימות פתוחות</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">הושלמו היום</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">פעילות אחרונה</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {operators.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                        אין מוקדנים מחוברים כרגע
                      </td>
                    </tr>
                  ) : (
                    operators.map((operator) => (
                      <tr key={operator.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                          {operator.full_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {operator.role === 'operator' ? 'מוקדן' : operator.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            🟢 פעיל
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          <span className="font-bold text-yellow-600">{operator.tasksOpen}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          <span className="font-bold text-green-600">{operator.tasksCompleted}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {operator.lastActive}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content - Tasks */}
        {activeTab === 'tasks' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">משימות פתוחות למוקדנים</h2>
              <button
                onClick={() => setShowTaskModal(true)}
                className="px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 font-medium flex items-center gap-2"
              >
                ➕ משימה חדשה
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">משימה</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">מוקצה ל</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">עדיפות</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">סטטוס</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">נוצר בשעה</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                        אין משימות כרגע. לחץ על "משימה חדשה" כדי ליצור.
                      </td>
                    </tr>
                  ) : (
                    tasks.map((task) => (
                      <tr key={task.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {task.title}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {task.assigned_user?.full_name || 'לא משוייך'}
                        </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          task.priority === 'דחוף' ? 'bg-red-100 text-red-800' :
                          task.priority === 'גבוה' ? 'bg-orange-100 text-orange-800' :
                          'bg-yellow-100 text-yellow-800'
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
                          {new Date(task.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content - Shifts */}
        {activeTab === 'shifts' && (
          <OnCallManagerNew />
        )}

        {/* Tab Content - Reports */}
        {activeTab === 'reports' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">דוחות ביצועים</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
                <h3 className="text-lg font-bold text-blue-900 mb-3">📊 סטטיסטיקות היום</h3>
                <div className="space-y-2 text-sm">
                  <p className="flex justify-between">
                    <span className="text-blue-700">סך פניות התקבלו:</span>
                    <span className="font-bold text-blue-900">47</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-blue-700">משימות הושלמו:</span>
                    <span className="font-bold text-blue-900">{totalTasksCompleted}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-blue-700">זמן תגובה ממוצע:</span>
                    <span className="font-bold text-blue-900">2.8 דקות</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-blue-700">שביעות רצון:</span>
                    <span className="font-bold text-blue-900">95%</span>
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
                <h3 className="text-lg font-bold text-green-900 mb-3">🏆 מוקדן מצטיין</h3>
                <div className="space-y-2 text-sm">
                  <p className="flex justify-between">
                    <span className="text-green-700">שם:</span>
                    <span className="font-bold text-green-900">שרה כהן</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-green-700">משימות הושלמו:</span>
                    <span className="font-bold text-green-900">15</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-green-700">זמן תגובה:</span>
                    <span className="font-bold text-green-900">2.5 דקות</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-green-700">דירוג:</span>
                    <span className="font-bold text-green-900">⭐⭐⭐⭐⭐</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-gray-900">יצירת משימה חדשה</h3>
              <button
                onClick={() => {
                  setShowTaskModal(false);
                  setNewTask({ title: '', description: '', assigned_to: '', priority: 'בינוני', due_date: '' });
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
                <label className="block text-sm font-medium text-gray-700 mb-2">שם המשימה *</label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-pink-500 focus:border-pink-500"
                  placeholder="למשל: בדיקת מקלט ברחוב הרצל"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">תיאור</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-pink-500 focus:border-pink-500"
                  placeholder="פרטים נוספים..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">הקצה למוקדן *</label>
                <select
                  value={newTask.assigned_to}
                  onChange={(e) => setNewTask({...newTask, assigned_to: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-pink-500 focus:border-pink-500"
                >
                  <option value="">בחר מוקדן</option>
                  {allUsers.filter(u => u.role === 'operator').map(user => (
                    <option key={user.id} value={user.id}>{user.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">עדיפות</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-pink-500 focus:border-pink-500"
                  >
                    <option value="דחוף">דחוף</option>
                    <option value="גבוה">גבוה</option>
                    <option value="בינוני">בינוני</option>
                    <option value="נמוך">נמוך</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">תאריך יעד</label>
                  <input
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({...newTask, due_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-pink-500 focus:border-pink-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateTask}
                  className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 font-medium"
                >
                  ✅ צור משימה
                </button>
                <button
                  onClick={() => {
                    setShowTaskModal(false);
                    setNewTask({ title: '', description: '', assigned_to: '', priority: 'בינוני', due_date: '' });
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

      {/* Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-gray-900">שליחת הודעה למוקדנים</h3>
              <button
                onClick={() => {
                  setShowMessageModal(false);
                  setMessageText('');
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
                  הודעה
                </label>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-pink-500 focus:border-pink-500"
                  placeholder="הקלד הודעה למוקדנים..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSendMessage}
                  className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 font-medium"
                >
                  📢 שלח לכולם
                </button>
                <button
                  onClick={() => {
                    setShowMessageModal(false);
                    setMessageText('');
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
