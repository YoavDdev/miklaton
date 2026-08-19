'use client';

import { useState } from 'react';
import ExcelImporter from '@/components/ExcelImporter';

/**
 * עטיפה דקה סביב יבואן האקסל, למסלול הקישור החתום.
 *
 * כל הפרסור, ההתאמה של שמות והתצוגה המקדימה הם אותו קוד בדיוק שרץ במסלול
 * המאומת - רק ההעלאה עצמה עוברת לראוט החתום. מקור אמת אחד לפרסור.
 */
export default function ScheduleUploadForm({ departmentId, token, staff, shifts, onDone }) {
  const [lastResult, setLastResult] = useState(null);

  // מה כבר קיים בשבוע היעד - לאזהרת הדריסה בתצוגה המקדימה (YOA-36)
  const checkExistingWeek = async (weekStart) => {
    const res = await fetch(
      `/api/schedule-upload?departmentId=${departmentId}&t=${token}&week_start=${weekStart}`
    );
    const data = await res.json();
    return data.success ? data.existingWeek : null;
  };

  const uploader = async ({ week_start, newShifts, entries, leaves }) => {
    const res = await fetch('/api/schedule-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        department_id: departmentId,
        token,
        week_start,
        // הראוט מייצר את המשמרות החסרות ומחזיר את המזהים שלהן, ולכן
        // השיבוצים נשלחים עם המפתח ולא עם shift_id שעדיין לא קיים.
        newShifts,
        leaves,
        entries: entries.map((e) => ({
          shift_key: e.shift_key,
          staff_id: e.staff_id,
          staff_name: e.staff_id ? null : e.staff_name,
          day_of_week: e.day_of_week,
          is_backup: e.is_backup,
          actual_start: e.actual_start,
          actual_end: e.actual_end,
          notes: e.notes,
        })),
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'ההעלאה נכשלה');
    setLastResult({ week: week_start, count: data.count });
    return data;
  };

  return (
    <div className="space-y-6">
      <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside bg-blue-50 border border-blue-200 rounded-lg p-4">
        <li>לחץ על הכפתור ובחר את קובץ הסידור השבועי</li>
        <li>המערכת תזהה את השבוע לפי התאריך שבגיליון ותציג תצוגה מקדימה</li>
        <li>אשר, וזהו</li>
      </ol>

      <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50">
        <div className="text-4xl mb-3">📄</div>
        <ExcelImporter
          departmentId={departmentId}
          currentWeekStart={new Date()}
          staff={staff}
          shifts={shifts}
          uploader={uploader}
          checkExistingWeek={checkExistingWeek}
          onImportComplete={onDone}
        />
      </div>

      {lastResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
          ✅ הועלו {lastResult.count} שיבוצים לשבוע {lastResult.week}. אפשר לסגור את הדף.
        </div>
      )}

      <p className="text-xs text-gray-500">
        {staff.length} עובדים ו-{shifts.length} סוגי משמרת מוגדרים במערכת. שם שלא
        מזוהה ייכנס כפי שהוא ולא יאבד.
      </p>
    </div>
  );
}
