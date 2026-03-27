'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function OperatorTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 30000); // רענון כל 30 שניות
    return () => clearInterval(interval);
  }, []);

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
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      const res = await fetch('/api/operator/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: taskId,
          status: newStatus
        })
      });

      if (res.ok) {
        toast.success('סטטוס עודכן! ✅');
        loadTasks();
      } else {
        toast.error('שגיאה בעדכון סטטוס');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('שגיאה בעדכון סטטוס');
    }
  };

  const pendingTasks = tasks.filter(t => t.status !== 'הושלם');
  const completedTasks = tasks.filter(t => t.status === 'הושלם');

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">טוען משימות...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          📋 המשימות שלי
          {pendingTasks.length > 0 && (
            <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
              {pendingTasks.length}
            </span>
          )}
        </h2>
      </div>

      <div className="p-6 space-y-4">
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg">אין משימות כרגע 🎉</p>
            <p className="text-sm mt-2">כל המשימות הושלמו!</p>
          </div>
        ) : (
          <>
            {/* Pending Tasks */}
            {pendingTasks.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold text-gray-700 text-lg border-b pb-2">פעילות פתוחות</h3>
                {pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`border-r-4 p-4 rounded-lg shadow-sm ${
                      task.priority === 'דחוף' ? 'bg-red-50 border-red-500' :
                      task.priority === 'גבוה' ? 'bg-orange-50 border-orange-500' :
                      'bg-yellow-50 border-yellow-500'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-gray-900">{task.title}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        task.priority === 'דחוף' ? 'bg-red-100 text-red-800' :
                        task.priority === 'גבוה' ? 'bg-orange-100 text-orange-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {task.priority}
                      </span>
                    </div>
                    
                    {task.description && (
                      <p className="text-sm text-gray-700 mb-3">{task.description}</p>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        נוצר: {new Date(task.created_at).toLocaleString('he-IL')}
                      </span>
                      
                      <div className="flex gap-2">
                        {task.status === 'ממתין' && (
                          <button
                            onClick={() => updateTaskStatus(task.id, 'בטיפול')}
                            className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                          >
                            התחל טיפול
                          </button>
                        )}
                        {task.status === 'בטיפול' && (
                          <button
                            onClick={() => updateTaskStatus(task.id, 'הושלם')}
                            className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                          >
                            ✅ סיים
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <div className="space-y-3 mt-6">
                <h3 className="font-bold text-gray-700 text-lg border-b pb-2">הושלמו היום</h3>
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-green-50 border-r-4 border-green-500 p-4 rounded-lg shadow-sm opacity-75"
                  >
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-gray-900 line-through">{task.title}</h4>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✅ הושלם
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 block mt-2">
                      הושלם: {new Date(task.completed_at || task.updated_at).toLocaleString('he-IL')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
