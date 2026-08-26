'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import ActiveEventBanner from '@/components/ActiveEventBanner';
import OperatorTasks from '@/components/OperatorTasks';
import CallCenterSchedule from '@/components/CallCenterSchedule';
import OperatorNotifications from '@/components/OperatorNotifications';
import SecurityWeeklySchedule from '@/components/SecurityWeeklySchedule';
import CityWorksManager from '@/components/CityWorksManager';
import SecurityFieldStatus from '@/components/SecurityFieldStatus';
import CallGuide from '@/components/CallGuide';
import PanicButtonSearch from '@/components/PanicButtonSearch';
import GarbageStreetSearch from '@/components/GarbageStreetSearch';

/**
 * קונסולת האחמ״ש - "מה קורה במשמרת שלי עכשיו".
 *
 * אחמ״ש מנהל את משמרת המוקד. עד היום התפקיד היה קיים בארגון ובתסריטי
 * ההתראה, אבל לא בתוכנה - שהכירה רק נציג ומנהלת מוקד (docs/15).
 */
export default function ShiftPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [shift, setShift] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [warMode, setWarMode] = useState(false);
  const [callCenterDeptId, setCallCenterDeptId] = useState('');
  const [securityDeptId, setSecurityDeptId] = useState('');

  const load = useCallback(async () => {
    try {
      const [meRes, shiftRes, sessionsRes, warRes] = await Promise.all([
        fetch('/api/auth/me', { credentials: 'include' }),
        fetch('/api/call-center-schedule/current', { credentials: 'include' }),
        fetch('/api/operator/sessions', { credentials: 'include' }),
        fetch('/api/war-mode', { credentials: 'include' }),
      ]);

      if (meRes.ok) {
        const me = (await meRes.json()).user;
        setUser(me);
        // מכלול המוקד. זיהוי לפי שם, כמו במסך - אין דגל ייעודי בסכימה.
        const deptRes = await fetch('/api/departments', { credentials: 'include' });
        if (deptRes.ok) {
          const list = (await deptRes.json()).data || [];
          const mokedDept = list.find((d) => (d.name || '').includes('מוקד'));
          setCallCenterDeptId(me?.department_id || mokedDept?.id || '');
          const securityDept = list.find((d) => (d.name || '').includes('טחון'));
          setSecurityDeptId(securityDept?.id || '');
        }
      }
      if (shiftRes.ok) setShift(await shiftRes.json());
      if (sessionsRes.ok) setSessions((await sessionsRes.json()).sessions || []);
      if (warRes.ok) {
        const w = await warRes.json();
        setWarMode(w?.data?.is_active || false);
      }
    } catch (error) {
      console.error('Error loading shift data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const toggleWarMode = async () => {
    const next = !warMode;
    const confirmed = window.confirm(
      next
        ? 'להעביר את כל המערכת למצב חירום?\n\nחיפוש המקלטים ורשימת הכוננים ייפתחו לכל המוקדנים, והמסך הציבורי ישתנה.'
        : 'לצאת ממצב חירום?\n\nחיפוש המקלטים ורשימת הכוננים יוסתרו, והמסך הציבורי יחזור למצב רגיל.'
    );
    if (!confirmed) return;

    const res = await fetch('/api/war-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ is_active: next }),
    });
    const data = await res.json();
    if (data.success) {
      setWarMode(next);
      toast.success(next ? 'המערכת במצב חירום' : 'המערכת חזרה למצב רגיל');
    } else {
      toast.error(data.error || 'העדכון נכשל');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <p className="text-gray-600">טוען...</p>
      </div>
    );
  }

  const activeShifts = shift?.activeShifts || [];
  const nextShift = shift?.next || shift?.nextShifts?.[0] || null;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Toaster position="top-center" />
      <ActiveEventBanner />

      <header className="bg-gradient-to-l from-indigo-800 to-slate-900 text-white shadow-xl">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">ניהול משמרת</h1>
            <p className="text-sm opacity-80">{user?.full_name || 'אחמ״ש'}</p>
          </div>
          {/* כלי החיפוש של עמדת המוקדן - גם לאחמ"ש (בקשת יואב 26.08) */}
          <div className="flex items-center gap-2 flex-wrap">
            <PanicButtonSearch />
            <GarbageStreetSearch />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/daily-report')}
              className="px-3 py-2 rounded-lg text-sm font-bold bg-white/10 hover:bg-white/20 border-2 border-white/20"
            >
              📄 דוח סיכום יומי
            </button>
            <button
              onClick={() => router.push('/operator')}
              className="px-3 py-2 rounded-lg text-sm font-bold bg-white/10 hover:bg-white/20 border-2 border-white/20"
            >
              🎧 עמדת מוקדן
            </button>
            <button
              onClick={toggleWarMode}
              className={`px-3 py-2 rounded-lg text-sm font-bold border-2 ${
                warMode
                  ? 'bg-red-600 hover:bg-red-700 border-red-400 animate-pulse'
                  : 'bg-white/10 hover:bg-white/20 border-white/20'
              }`}
            >
              {warMode ? '🚨 מצב חירום' : '⚪ מצב רגיל'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* סטטוס השטח של מכלול הביטחון - כמו בעמדת המוקדן */}
        <SecurityFieldStatus />

        {/* מי במשמרת עכשיו */}
        <section className="bg-white rounded-xl shadow p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-3">המשמרת עכשיו</h2>
          {activeShifts.length === 0 ? (
            <p className="text-sm text-gray-500">אין משמרת פעילה בסידור לשעה זו.</p>
          ) : (
            <div className="space-y-3">
              {activeShifts.map((s, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-baseline justify-between flex-wrap gap-2">
                    <span className="font-bold text-gray-900">{s.shift?.name}</span>
                    <span className="text-sm text-gray-500">
                      {s.shift?.start_time?.slice(0, 5)}–{s.shift?.end_time?.slice(0, 5)}
                    </span>
                  </div>
                  <p className="text-sm mt-2">
                    <span className="text-gray-500">אחמ״ש: </span>
                    <span className="font-semibold">{s.managers?.join(', ') || '—'}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-gray-500">נציגים: </span>
                    {s.reps?.join(', ') || '—'}
                  </p>
                </div>
              ))}
            </div>
          )}
          {nextShift && (
            <p className="text-xs text-gray-500 mt-3">
              המשמרת הבאה: {nextShift.shift?.name} בשעה {nextShift.shift?.start_time?.slice(0, 5)}
            </p>
          )}
        </section>

        {/* מי מחובר בפועל */}
        <section className="bg-white rounded-xl shadow p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            מחוברים כרגע ({sessions.length})
          </h2>
          {sessions.length === 0 ? (
            <p className="text-sm text-gray-500">אף אחד לא מחובר כרגע.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sessions.map((s) => (
                <li key={s.user_id} className="py-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-900">
                    {s.user?.full_name || 'לא ידוע'}
                  </span>
                  <span className="text-gray-500">{s.user?.role === 'operator' ? 'מוקדן' : s.user?.role}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-gray-400 mt-3">
            מבוסס על פעילות ב-15 הדקות האחרונות. מי שבסידור ואינו כאן - כנראה עדיין לא נכנס.
          </p>
        </section>

        {/* הודעות למסך הציבורי ולנציגים - פרסום ומחיקה הם סמכות משמרת:
            הורדו ממוקדנים בהחלטת מדיניות (docs/15, 2026-08-19) */}
        <section className="bg-white rounded-xl shadow p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-3">הודעות למוקד ולמסך</h2>
          <OperatorNotifications canManage author={user?.full_name || 'אחמ״ש'} />
        </section>

        {/* כוננויות - מדריך ההתקשרות של עמדת המוקדן */}
        <section className="bg-white rounded-xl shadow overflow-hidden">
          <CallGuide />
        </section>

        {/* סידור המוקד - אחמ״ש מזין משמרות תמיד, לא רק כשהוא במשמרת */}
        {callCenterDeptId && (
          <section className="bg-white rounded-xl shadow p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-3">סידור המוקד</h2>
            <CallCenterSchedule departmentId={callCenterDeptId} canEdit />
          </section>
        )}

        {/* סידור הביטחון - אותה טבלה שיש לאריאל (מנהל המכלול) ולמירי
            (מנהלת המוקד), נגישה גם לאחמ"ש (בקשת יואב 26.08) */}
        {securityDeptId && (
          <section className="bg-white rounded-xl shadow p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-1">🛡️ סידור הביטחון</h2>
            <p className="text-xs text-gray-500 mb-3">אותה טבלה של מנהל המכלול ומנהלת המוקד - שינוי כאן מתעדכן מיד על מסך המוקד.</p>
            <SecurityWeeklySchedule departmentId={securityDeptId} />
          </section>
        )}

        {/* עבודות בעיר - הרשימה המנוהלת של הדוח היומי והמסך */}
        <section className="bg-white rounded-xl shadow p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-1">🚧 עבודות בעיר</h2>
          <CityWorksManager />
        </section>

        {/* משימות המשמרת */}
        <section className="bg-white rounded-xl shadow p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-3">משימות</h2>
          <OperatorTasks />
        </section>
      </main>
    </div>
  );
}
