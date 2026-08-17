'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';
import FlowRunner from '@/components/FlowRunner';
import ShelterSearch from '@/components/ShelterSearch';
import ShelterStatusManager from '@/components/ShelterStatusManager';
import OperatorNotifications from '@/components/OperatorNotifications';
import ActiveEventBanner from '@/components/ActiveEventBanner';
import WeeklyDutyRoster from '@/components/WeeklyDutyRoster';
import OperatorTasks from '@/components/OperatorTasks';
import DailyUpdatesPanel from '@/components/DailyUpdatesPanel';
import CallGuide from '@/components/CallGuide';
import PanicButtonSearch from '@/components/PanicButtonSearch';
import GarbageStreetSearch from '@/components/GarbageStreetSearch';
import KnowledgeChatSidebar from '@/components/KnowledgeChatSidebar';
import SecurityFieldStatus from '@/components/SecurityFieldStatus';
import { getMunicipalityId } from '@/lib/municipality';
import alertFlowsData from '@/data/alertFlows.json';
import sheltersData from '@/data/shelters.json';

const PrintableShelterList = dynamic(() => import('@/components/PrintableShelterList'), {
  ssr: false
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function OperatorPage() {
  const router = useRouter();
  const [selectedFlowId, setSelectedFlowId] = useState('early_warning_then_alarm');
  const [activeEvent, setActiveEvent] = useState(null);
  const [warMode, setWarMode] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showShelters, setShowShelters] = useState(false);
  const [showDutyRoster, setShowDutyRoster] = useState(false);
  const [taskCount, setTaskCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const dutyRosterRef = useRef(null);

  useEffect(() => {
    // Check if user is admin
    const checkAdminStatus = async () => {
      try {
        const res = await fetch('/api/auth/verify');
        if (res.ok) {
          const data = await res.json();
          setIsAdmin(data.isAdmin || false);
        }
      } catch {}
    };
    checkAdminStatus();

    // Heartbeat - עדכון סשן פעיל כל 10 שניות
    const sendHeartbeat = async () => {
      try {
        await fetch('/api/operator/sessions', {
          method: 'POST',
          credentials: 'include'
        });
      } catch (error) {
        console.error('Heartbeat error:', error);
      }
    };

    // שלח heartbeat מיידי
    sendHeartbeat();

    // המשך לשלוח כל 10 שניות
    const heartbeatInterval = setInterval(sendHeartbeat, 10000);

    // Cleanup - סיום סשן כשעוזבים את הדף
    const handleBeforeUnload = async () => {
      try {
        await fetch('/api/operator/sessions', {
          method: 'DELETE',
          credentials: 'include',
          keepalive: true
        });
      } catch {}
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // ניסיון לסיים סשן
      handleBeforeUnload();
    };
  }, []);

  useEffect(() => {
    // Fetch task and notification counts
    const fetchCounts = async () => {
      try {
        // משימות ממתינות. הסטטוסים בעברית - כך אוכף ה-CHECK על operator_tasks.
        const tasksRes = await fetch('/api/operator/tasks?status=ממתין', {
          credentials: 'include'
        });
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          setTaskCount(tasksData.tasks?.length || 0);
        }

        // התראות פעילות. אין מעקב נקרא/לא-נקרא בסכימה, ולכן זה מונה את מה
        // שה-API מחזיר אחרי סינון התאריכים - וזו גם ההתנהגות שהיתה כאן קודם.
        const notifRes = await fetch('/api/notifications', {
          credentials: 'include'
        });
        if (notifRes.ok) {
          const notifData = await notifRes.json();
          setNotificationCount(notifData.notifications?.length || 0);
        }
      } catch (error) {
        console.error('Error fetching counts:', error);
      }
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Fetch initial war mode status
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

    // Subscribe to war mode changes via Supabase realtime
    const channel = supabase
      .channel('war_mode_changes')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'war_mode' },
        (payload) => {
          setWarMode(payload.new.is_active || false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleWarMode = async () => {
    const username = localStorage.getItem('username') || 'מוקדן';
    const newMode = !warMode;
    
    try {
      const res = await fetch('/api/war-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: newMode,
          updated_by: username
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

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const startEvent = () => {
    const flow = alertFlowsData.find((f) => f.id === selectedFlowId);
    if (flow) {
      setActiveEvent(flow);
    }
  };

  const endEvent = (summary) => {
    setActiveEvent(null);
  };

  const resetEvent = () => {
    setActiveEvent(null);
    setSelectedFlowId('early_warning_then_alarm');
  };

  const ekronUrl = process.env.NEXT_PUBLIC_EKRON_URL || '#';
  const incidentFormUrl = process.env.NEXT_PUBLIC_INCIDENT_FORM_URL || '#';

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <ActiveEventBanner />

      {/* ── Header ── */}
      <header className="bg-gradient-to-l from-slate-800 to-slate-900 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold shrink-0">🎧 מוקד חירום</h1>
            <PanicButtonSearch />
            <GarbageStreetSearch />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/screen"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-all border-2 bg-white/10 hover:bg-white/20 border-white/20 text-white"
            >
              🖥️ <span className="hidden sm:inline">מסך תצוגה</span>
            </a>
            <button
              onClick={toggleWarMode}
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

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Security Field Status */}
        <SecurityFieldStatus />

        {/* Collapsible Info Section - Tasks & Notifications */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Tasks Summary Card */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <button
              onClick={() => setShowTasks(!showTasks)}
              className="w-full px-5 py-4 flex items-center justify-between bg-gradient-to-r from-orange-50 to-white hover:from-orange-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <span className="font-bold text-gray-900">משימות פתוחות</span>
                {taskCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                    {taskCount}
                  </span>
                )}
              </div>
              <svg className={`w-5 h-5 text-gray-500 transition-transform ${showTasks ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showTasks && (
              <div className="px-5 pb-4">
                <OperatorTasks compact />
              </div>
            )}
          </div>

          {/* Notifications Summary Card */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-full px-5 py-4 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white hover:from-blue-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">📢</span>
                <span className="font-bold text-gray-900">הודעות והנחיות</span>
                {notificationCount > 0 && (
                  <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                    {notificationCount}
                  </span>
                )}
              </div>
              <svg className={`w-5 h-5 text-gray-500 transition-transform ${showNotifications ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showNotifications && (
              <div className="px-5 pb-4">
                <OperatorNotifications />
              </div>
            )}
          </div>
        </div>

        {/* Call Guide – inline */}
        <div className="mb-6">
          <CallGuide />
        </div>

        {/* Knowledge Chat - Floating Sidebar */}
        <KnowledgeChatSidebar userName={typeof window !== 'undefined' ? (localStorage.getItem('username') || 'מוקדן') : 'מוקדן'} />

        {/* Daily Updates - NEW */}
        <div className="mb-6">
          <DailyUpdatesPanel canEdit={true} />
        </div>

        {/* Main Action Area - Emergency Response - Only visible in emergency mode */}
        {warMode && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          {/* Emergency Event Panel */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    🚨 ניהול אירוע חירום
                  </h2>
                  {activeEvent && (
                    <button
                      onClick={resetEvent}
                      className="bg-white/20 hover:bg-white/30 text-white text-sm font-semibold py-1.5 px-3 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      רענון
                    </button>
                  )}
                </div>
              </div>
              <div className="p-6">
                {!activeEvent ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        בחר סוג אירוע
                      </label>
                      <select
                        value={selectedFlowId}
                        onChange={(e) => setSelectedFlowId(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-200 focus:outline-none transition-all"
                      >
                        {alertFlowsData.map((flow) => (
                          <option key={flow.id} value={flow.id} disabled={flow.steps.length === 0}>
                            {flow.title} {flow.steps.length === 0 ? '(לא זמין)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={startEvent}
                      disabled={!selectedFlowId || alertFlowsData.find(f => f.id === selectedFlowId)?.steps.length === 0}
                      className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-6 rounded-lg text-lg transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
                    >
                      🚨 התחל אירוע
                    </button>
                  </div>
                ) : (
                  <FlowRunner flow={activeEvent} onEnd={endEvent} warMode={warMode} />
                )}
              </div>
            </div>

            {/* Ekron Link - Compact */}
            <div className="mt-4 bg-gradient-to-l from-slate-700 to-slate-800 rounded-xl shadow-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">�️</span>
                  <div>
                    <p className="font-bold text-white">קריאה מתושב</p>
                    <p className="text-slate-300 text-sm">טיל / לכוד / פצוע / מידע חירום</p>
                  </div>
                </div>
                <a
                  href={ekronUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold py-2 px-5 rounded-lg transition-colors"
                >
                  פתח Ekron →
                </a>
              </div>
            </div>
          </div>

          {/* Shelter Search - Compact Side Panel */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                📍 חיפוש מקלט
              </h2>
            </div>
            <div className="p-5">
              <ShelterSearch compact />
            </div>
          </div>
        </div>
        )}

        {/* Shelter Management - Collapsible */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
          <button
            onClick={() => setShowShelters(!showShelters)}
            className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏢</span>
              <span className="text-lg font-bold text-white">ניהול מקלטים ציבוריים</span>
            </div>
            <div className="flex items-center gap-3">
              <PrintableShelterList shelters={sheltersData} />
              <svg className={`w-5 h-5 text-gray-300 transition-transform ${showShelters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          {showShelters && (
            <div className="p-6">
              <ShelterStatusManager shelters={sheltersData} />
            </div>
          )}
        </div>

        {/* Weekly Duty Roster - Collapsible - Only in emergency mode */}
        {warMode && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
          <button
            onClick={() => setShowDutyRoster(!showDutyRoster)}
            className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-l from-slate-700 to-slate-800 hover:from-slate-600 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📅</span>
              <span className="text-lg font-bold text-white">🚨 לוח כוננויות חירום שבועי</span>
            </div>
            <div className="flex items-center gap-3">
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  dutyRosterRef.current?.print();
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    dutyRosterRef.current?.print();
                  }
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-colors flex items-center gap-2 cursor-pointer"
              >
                🖨️ הדפס כוננויות
              </div>
              <svg className={`w-5 h-5 text-gray-300 transition-transform ${showDutyRoster ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          {showDutyRoster && (
            <div className="p-6">
              <WeeklyDutyRoster ref={dutyRosterRef} />
            </div>
          )}
        </div>
        )}
      </main>
    </div>
  );
}
