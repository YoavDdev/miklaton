'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import ScheduleUploadForm from '@/components/ScheduleUploadForm';

/**
 * העלאת סידור הביטחון מקישור קבוע, בלי התחברות.
 *
 * הדף הזה קיים כי מנהל המכלול עובד באקסל כבר שנים ולא רגיל להיכנס לאתר.
 * מסך אחד, אזור העלאה אחד, ואישור - בלי ניווט ובלי סיסמה.
 */
export default function ScheduleUploadPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const departmentId = params.departmentId;
  const token = searchParams.get('t');

  const [state, setState] = useState({ status: 'loading' });

  const load = useCallback(async () => {
    if (!token) {
      setState({ status: 'error', message: 'קישור לא תקין - חסר טוקן' });
      return;
    }
    try {
      const res = await fetch(
        `/api/schedule-upload?departmentId=${departmentId}&t=${encodeURIComponent(token)}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setState({ status: 'error', message: data.error || 'קישור לא תקין' });
        return;
      }
      setState({ status: 'ready', ...data });
    } catch {
      setState({ status: 'error', message: 'שגיאת תקשורת - נסה שוב' });
    }
  }, [departmentId, token]);

  useEffect(() => { load(); }, [load]);

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 flex items-start justify-center p-4 sm:p-8">
      <Toaster position="top-center" />
      <div className="w-full max-w-3xl">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-l from-green-600 to-blue-600 text-white p-6">
            <h1 className="text-2xl font-bold">העלאת סידור עבודה</h1>
            <p className="text-sm opacity-90 mt-1">
              {state.status === 'ready' ? state.department?.name : 'מכלול ביטחון'}
            </p>
          </div>

          <div className="p-6">
            {state.status === 'loading' && (
              <p className="text-center text-gray-500 py-12">טוען...</p>
            )}

            {state.status === 'error' && (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">🔒</div>
                <p className="font-bold text-gray-900 mb-2">{state.message}</p>
                <p className="text-sm text-gray-600">יש לבקש קישור חדש מהמוקד.</p>
              </div>
            )}

            {state.status === 'ready' && (
              <ScheduleUploadForm
                departmentId={departmentId}
                token={token}
                staff={state.staff}
                shifts={state.shifts}
                onDone={load}
              />
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          מיקלטון · העלאת הקובץ מחליפה את הסידור של השבוע שמופיע בגיליון
        </p>
      </div>
    </div>
  );
}
