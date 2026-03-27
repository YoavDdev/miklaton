'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

export default function OperatorTasksPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all'); // all, ממתין, בטיפול, הושלם
  const [selectedTask, setSelectedTask] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    checkAuth();
    loadTasks();
    const interval = setInterval(loadTasks, 30000); // רענון כל 30 שניות
    return () => clearInterval(interval);
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
      
      if (data.user.role !== 'operator' && data.user.role !== 'admin') {
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

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      const res = await fetch('/api/operator/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: taskId,
          status: newStatus,
          notes
        })
      });

      if (res.ok) {
        toast.success(`משימה עודכנה ל${newStatus}! ✅`);
        loadTasks();
        setShowDetailsModal(false);
        setSelectedTask(null);
        setNotes('');
      } else {
        toast.error('שגיאה בעדכון משימה');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('שגיאה בעדכון משימה');
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

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  const pendingCount = tasks.filter(t => t.status === 'ממתין').length;
  const inProgressCount = tasks.filter(t => t.status === 'בטיפול').length;
  const completedCount = tasks.filter(t => t.status === 'הושלם').length;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">המשימות שלי</h1>
              <p className="text-sm text-blue-100">שלום, {user?.full_name}</p>
            </div>
            <div className="flex gap-3">
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
                <p className="text-sm text-gray-600">סך המשימות</p>
                <p className="text-3xl font-bold text-blue-600">{tasks.length}</p>
              </div>
              <div className="text-4xl">📋</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ממתין</p>
                <p className="text-3xl font-bold text-gray-600">{pendingCount}</p>
              </div>
              <div className="text-4xl">⏳</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">בטיפול</p>
                <p className="text-3xl font-bold text-yellow-600">{inProgressCount}</p>
              </div>
              <div className="text-4xl">🔄</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">הושלם</p>
                <p className="text-3xl font-bold text-green-600">{completedCount}</p>
              </div>
              <div className="text-4xl">✅</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex gap-3">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              הכל ({tasks.length})
            </button>
            <button
              onClick={() => setFilter('ממתין')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                filter === 'ממתין'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ממתין ({pendingCount})
            </button>
            <button
              onClick={() => setFilter('בטיפול')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                filter === 'בטיפול'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              בטיפול ({inProgressCount})
            </button>
            <button
              onClick={() => setFilter('הושלם')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                filter === 'הושלם'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              הושלם ({completedCount})
            </button>
          </div>
        </div>

        {/* Tasks List */}
        <div className="bg-white rounded-lg shadow">
          {filteredTasks.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-xl font-medium">אין משימות {filter !== 'all' ? `ב"${filter}"` : ''}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => {
                    setSelectedTask(task);
                    setNotes(task.notes || '');
                    setShowDetailsModal(true);
                  }}
                >
                  <div className="flex items-start justify-between">
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
                      
                      {task.description && (
                        <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>נוצר: {new Date(task.created_at).toLocaleString('he-IL')}</span>
                        {task.due_date && (
                          <span>יעד: {new Date(task.due_date).toLocaleDateString('he-IL')}</span>
                        )}
                        {task.created_user?.full_name && (
                          <span>ע"י: {task.created_user.full_name}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="mr-4">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Task Details Modal */}
      {showDetailsModal && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{selectedTask.title}</h3>
                <div className="flex gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedTask.priority === 'דחוף' ? 'bg-red-100 text-red-800' :
                    selectedTask.priority === 'גבוה' ? 'bg-orange-100 text-orange-800' :
                    selectedTask.priority === 'בינוני' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    עדיפות: {selectedTask.priority}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedTask.status === 'הושלם' ? 'bg-green-100 text-green-800' :
                    selectedTask.status === 'בטיפול' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    סטטוס: {selectedTask.status}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedTask(null);
                  setNotes('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {selectedTask.description && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">תיאור:</h4>
                  <p className="text-gray-600">{selectedTask.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">נוצר בתאריך:</span>
                  <p className="font-medium">{new Date(selectedTask.created_at).toLocaleString('he-IL')}</p>
                </div>
                {selectedTask.due_date && (
                  <div>
                    <span className="text-gray-500">תאריך יעד:</span>
                    <p className="font-medium">{new Date(selectedTask.due_date).toLocaleDateString('he-IL')}</p>
                  </div>
                )}
                {selectedTask.created_user?.full_name && (
                  <div>
                    <span className="text-gray-500">נוצר על ידי:</span>
                    <p className="font-medium">{selectedTask.created_user.full_name}</p>
                  </div>
                )}
                {selectedTask.completed_at && (
                  <div>
                    <span className="text-gray-500">הושלם בתאריך:</span>
                    <p className="font-medium">{new Date(selectedTask.completed_at).toLocaleString('he-IL')}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">הערות:</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="הוסף הערות..."
                />
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">עדכן סטטוס:</p>
                <div className="flex gap-3">
                  {selectedTask.status !== 'בטיפול' && (
                    <button
                      onClick={() => handleUpdateStatus(selectedTask.id, 'בטיפול')}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                    >
                      🔄 העבר לבטיפול
                    </button>
                  )}
                  {selectedTask.status !== 'הושלם' && (
                    <button
                      onClick={() => handleUpdateStatus(selectedTask.id, 'הושלם')}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
                    >
                      ✅ סמן כהושלם
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      setSelectedTask(null);
                      setNotes('');
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium"
                  >
                    סגור
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
