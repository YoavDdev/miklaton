'use client';

import { useEffect, useState } from 'react';
import HolidayDutyBoard from '@/components/HolidayDutyBoard';

/**
 * צפייה ציבורית בלוח כוננות החג, לפי קישור חתום שנשלח בוואטסאפ.
 *
 * הכתובת נפרדת מ-/holiday-duty בכוונה: הנתיב ההוא מוגן ב-middleware, וקישור
 * ציבורי שיושב תחתיו היה נשבר בשקט אם מישהו ירחיב את ההגנה לכל תת-הנתיבים.
 */
export default function HolidaySharePage({ params }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('t') || '';
    (async () => {
      try {
        const res = await fetch(
          `/api/holiday-duty/share?period=${params.periodId}&t=${encodeURIComponent(token)}`
        );
        const json = await res.json();
        if (json.success) setData(json);
        else setError(json.error || 'הקישור אינו תקין');
      } catch {
        setError('שגיאה בטעינת הלוח');
      }
    })();
  }, [params.periodId]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
        <div className="text-center">
          <div className="text-4xl mb-3">🔒</div>
          <p className="text-red-600 font-semibold">{error}</p>
          <p className="text-gray-500 text-sm mt-2">בקש קישור מעודכן מהמוקד.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-slate-700" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4" dir="rtl">
      <div id="holiday-board">
        <HolidayDutyBoard period={data.period} topics={data.topics} isActive={false} compact />
      </div>
      <button
        onClick={() => window.print()}
        className="no-print mt-4 w-full py-3 rounded-xl bg-slate-800 text-white font-bold"
      >
        🖨️ הדפס / שמור כ-PDF
      </button>
    </div>
  );
}
