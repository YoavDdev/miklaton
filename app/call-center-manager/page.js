'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import toast, { Toaster } from 'react-hot-toast';
import OnCallManagerNew from '@/components/OnCallManagerNew';
import ActiveEventBanner from '@/components/ActiveEventBanner';
import SurveyManager from '@/components/SurveyManager';
import CallCategoryManager from '@/components/CallCategoryManager';
import WhatsAppDutyLinks from '@/components/WhatsAppDutyLinks';
import SecurityFieldStatus from '@/components/SecurityFieldStatus';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [messageTitle, setMessageTitle] = useState('');
  const [isImportant, setIsImportant] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [previousMessages, setPreviousMessages] = useState([]);
  const [newTask, setNewTask] = useState({ title: '', description: '', assigned_to: '', priority: 'בינוני', due_date: '' });
  const [warMode, setWarMode] = useState(false);

  useEffect(() => {
    checkAuth();
    loadData();
    loadPreviousMessages();
    const interval = setInterval(loadSessions, 10000); // רענון כל 10 שניות

    // Fetch war mode status
    const fetchWarMode = async () => {
      try {
        const res = await fetch('/api/war-mode');
        const data = await res.json();
        if (data.success && data.data) {
          setWarMode(data.data.is_active || false);
        }
      } catch (error) {
        console.error('Failed to fetch war mode:', error);
      }
    };
    fetchWarMode();

    // Subscribe to war mode changes
    const channel = supabase
      .channel('war_mode_changes_ccm')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'war_mode' },
        (payload) => {
          setWarMode(payload.new.is_active || false);
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  // עדכון operators כאשר sessions או tasks משתנים
  useEffect(() => {
    if (sessions.length > 0) {
      const operatorsData = sessions.map(session => {
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
  }, [sessions, tasks]);

  // Send message to all operators
  const sendMessageToOperators = async () => {
    if (!messageTitle.trim() || !messageText.trim()) return;
    
    setSendingMessage(true);
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: messageTitle,
          message: messageText,
          type: isImportant ? 'urgent' : 'info',
          author: user?.full_name || 'מנהל מוקד'
        })
      });
      
      if (response.ok) {
        toast.success('הודעה נשלחה בהצלחה לכל המוקדנים!');
        setMessageTitle('');
        setMessageText('');
        setIsImportant(false);
        // Refresh messages list
        loadPreviousMessages();
      } else {
        toast.error('שגיאה בשליחת ההודעה');
      }
    } catch (error) {
      toast.error('שגיאה בשליחת ההודעה');
    } finally {
      setSendingMessage(false);
    }
  };

  // Load previous messages
  const loadPreviousMessages = async () => {
    try {
      const response = await fetch('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        setPreviousMessages(data.notifications || []);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Delete message
  const deleteMessage = async (messageId) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק הודעה זו?')) return;
    
    try {
      const response = await fetch(`/api/notifications?id=${messageId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        toast.success('הודעה נמחקה בהצלחה');
        loadPreviousMessages();
      } else {
        toast.error('שגיאה במחיקת ההודעה');
      }
    } catch (error) {
      toast.error('שגיאה במחיקת ההודעה');
    }
  };

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
      const taskData = {
        ...newTask,
        due_date: newTask.due_date || null
      };
      
      const res = await fetch('/api/operator/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(taskData)
      });

      if (res.ok) {
        toast.success('משימה נוצרה בהצלחה! ✅');
        setShowTaskModal(false);
        setNewTask({ title: '', description: '', assigned_to: '', priority: 'בינוני', due_date: '' });
        loadTasks();
      } else {
        const errorData = await res.json();
        console.error('Task creation error:', errorData);
        toast.error(errorData.error || 'שגיאה ביצירת משימה');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('שגיאה ביצירת משימה');
    }
  };

  const handleEditTask = async () => {
    if (!editingTask.title) {
      toast.error('נא למלא שם משימה');
      return;
    }

    try {
      const res = await fetch('/api/operator/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: editingTask.id,
          status: editingTask.status,
          notes: editingTask.notes
        })
      });

      if (res.ok) {
        toast.success('משימה עודכנה בהצלחה! ✅');
        setShowEditTaskModal(false);
        setEditingTask(null);
        loadTasks();
      } else {
        toast.error('שגיאה בעדכון משימה');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('שגיאה בעדכון משימה');
    }
  };

  const handleDeleteTask = async (taskId, taskTitle) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את המשימה "${taskTitle}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/operator/tasks?id=${taskId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (res.ok) {
        toast.success('משימה נמחקה בהצלחה! 🗑️');
        loadTasks();
      } else {
        toast.error('שגיאה במחיקת משימה');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('שגיאה במחיקת משימה');
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
      <ActiveEventBanner />

      {/* Header with war mode toggle */}
      <header className="bg-gradient-to-l from-pink-800 to-pink-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">📋 ניהול מוקד</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const username = localStorage.getItem('username') || 'מנהל מוקד';
                const newMode = !warMode;
                try {
                  const res = await fetch('/api/war-mode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_active: newMode, updated_by: username })
                  });
                  const data = await res.json();
                  if (data.success) setWarMode(newMode);
                } catch (error) {
                  toast.error('שגיאה בעדכון מצב חירום');
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-all border-2 ${
                warMode
                  ? 'bg-red-600 hover:bg-red-700 border-red-400 text-white animate-pulse'
                  : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
              }`}
            >
              {warMode ? '🚨 מצב חירום' : '⚪ מצב רגיל'}
            </button>
          </div>
        </div>
      </header>

      {warMode && (
        <div className="bg-red-600 text-white text-center py-2 text-sm font-bold">
          🚨 מצב חירום פעיל – שלבי מקלטים והתקשרויות ידלגו אוטומטית
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Security Field Status */}
        <SecurityFieldStatus />

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
                onClick={() => setActiveTab('emergency-shifts')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'emergency-shifts'
                    ? 'border-pink-600 text-pink-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🚨 כוננות חירום
              </button>
              <button
                onClick={() => setActiveTab('messages')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'messages'
                    ? 'border-pink-600 text-pink-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📢 הודעות והנחיות
              </button>
              <button
                onClick={() => setActiveTab('surveys')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'surveys'
                    ? 'border-pink-600 text-pink-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📊 סקרים
              </button>
              <button
                onClick={() => setActiveTab('call-categories')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'call-categories'
                    ? 'border-pink-600 text-pink-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📋 קטגוריות פניות
              </button>
              <button
                onClick={() => setActiveTab('whatsapp')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'whatsapp'
                    ? 'border-pink-600 text-pink-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📱 WhatsApp כוננויות
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
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">פעולות</th>
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                setEditingTask(task);
                                setShowEditTaskModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              ✏️ ערוך
                            </button>
                            <button
                              onClick={() => handleDeleteTask(task.id, task.title)}
                              className="text-red-600 hover:text-red-800 font-medium"
                            >
                              🗑️ מחק
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content - Emergency Shifts */}
        {activeTab === 'emergency-shifts' && (
          <OnCallManagerNew />
        )}

        {/* Tab Content - Surveys */}
        {activeTab === 'surveys' && (
          <SurveyManager />
        )}

        {/* Tab Content - Call Categories */}
        {activeTab === 'call-categories' && (
          <CallCategoryManager />
        )}

        {/* Tab Content - WhatsApp */}
        {activeTab === 'whatsapp' && (
          <WhatsAppDutyLinks />
        )}

        {/* Tab Content - Messages & Announcements */}
        {activeTab === 'messages' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-2">📢 הודעות והנחיות</h2>
              <p className="text-sm text-gray-600">שלח הודעה לכל המוקדנים באזור הודעות והנחיות</p>
            </div>
            
            <div className="p-6">
              <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl p-6 border-2 border-pink-200 mb-6">
                <h3 className="text-lg font-bold text-pink-900 mb-4">📝 שליחת הודעה חדשה</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">כותרת ההודעה</label>
                    <input
                      type="text"
                      value={messageTitle}
                      onChange={(e) => setMessageTitle(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-pink-500 focus:outline-none"
                      placeholder="למשל: עדכון חשוב לגבי תחנה 1"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">תוכן ההודעה</label>
                    <textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      rows={5}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-pink-500 focus:outline-none resize-none"
                      placeholder="כתוב כאן את ההודעה שתופיע לכל המוקדנים..."
                    />
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isImportant}
                        onChange={(e) => setIsImportant(e.target.checked)}
                        className="w-5 h-5 text-pink-600 rounded focus:ring-pink-500"
                      />
                      <span className="text-sm font-medium text-gray-700">🔴 הודעה דחופה</span>
                    </label>
                  </div>
                  
                  <button
                    onClick={sendMessageToOperators}
                    disabled={!messageText.trim() || !messageTitle.trim() || sendingMessage}
                    className="w-full px-6 py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg font-semibold hover:from-pink-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {sendingMessage ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        שולח...
                      </>
                    ) : (
                      <>
                        📤 שלח הודעה לכל המוקדנים
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Previous Messages */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">📜 הודעות קודמות</h3>
                <div className="space-y-3">
                  {previousMessages.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-4xl mb-2">📝</div>
                      <p>אין הודעות קודמות</p>
                    </div>
                  ) : (
                    previousMessages.map((msg) => (
                      <div key={msg.id} className={`p-4 rounded-lg border-2 ${msg.type === 'urgent' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-bold text-gray-900">{msg.title}</h4>
                          <div className="flex items-center gap-2">
                            {msg.type === 'urgent' && (
                              <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full">🔴 דחוף</span>
                            )}
                            <button
                              onClick={() => deleteMessage(msg.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                              title="מחק הודעה"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <p className="text-gray-700 mb-2">{msg.message}</p>
                        <div className="text-xs text-gray-500">
                          נשלח על ידי {msg.author} | {new Date(msg.created_at).toLocaleString('he-IL')}
                        </div>
                      </div>
                    ))
                  )}
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

      {/* Edit Task Modal */}
      {showEditTaskModal && editingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-gray-900">עריכת משימה</h3>
              <button
                onClick={() => {
                  setShowEditTaskModal(false);
                  setEditingTask(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600">משימה: <span className="font-bold text-gray-900">{editingTask.title}</span></p>
                <p className="text-sm text-gray-600 mt-1">מוקצה ל: <span className="font-bold text-gray-900">{editingTask.assigned_user?.full_name}</span></p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">סטטוס</label>
                <select
                  value={editingTask.status}
                  onChange={(e) => setEditingTask({...editingTask, status: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-pink-500 focus:border-pink-500"
                >
                  <option value="ממתין">ממתין</option>
                  <option value="בטיפול">בטיפול</option>
                  <option value="הושלם">הושלם</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">הערות</label>
                <textarea
                  value={editingTask.notes || ''}
                  onChange={(e) => setEditingTask({...editingTask, notes: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-pink-500 focus:border-pink-500"
                  placeholder="הערות נוספות..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleEditTask}
                  className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 font-medium"
                >
                  ✅ עדכן משימה
                </button>
                <button
                  onClick={() => {
                    setShowEditTaskModal(false);
                    setEditingTask(null);
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
