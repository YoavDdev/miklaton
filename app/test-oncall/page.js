'use client';

import { useState, useEffect } from 'react';
import OnCallDynamic from '@/components/OnCallDynamic';

/**
 * דף בדיקה לרכיב OnCallDynamic
 * 
 * משתמש במערכת הקיימת (contacts + duty_roster)
 */
export default function TestOnCallPage() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // No need to fetch municipality for legacy system
    setLoading(false);
  }, []);


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🧪 בדיקת רכיב כוננים דינמי
          </h1>
          <p className="text-gray-600">
            דף זה מציג את רכיב OnCallDynamic החדש
          </p>
        </div>

        {/* Component */}
        <OnCallDynamic useLegacyApi={true} />

        {/* Info */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="font-bold text-blue-900 mb-2">💡 מידע:</h3>
          <ul className="text-blue-700 text-sm space-y-1">
            <li>• הרכיב משתמש במערכת הקיימת (contacts + duty_roster)</li>
            <li>• מציג את הכוננים הפעילים כרגע לפי יום ושעה</li>
            <li>• לחיצה על כפתור "התקשר" תפתח את אפליקציית הטלפון</li>
            <li>• לחיצה על כפתור העתקה תעתיק את המספר ללוח</li>
            <li>• הרכיב מתעדכן אוטומטית כל 5 דקות</li>
          </ul>
        </div>

        {/* Stats */}
        <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
          <h3 className="font-bold text-green-900 mb-2">📊 נתונים במערכת:</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-700">11</div>
              <div className="text-xs text-green-600">מחלקות</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-700">98</div>
              <div className="text-xs text-green-600">אנשי קשר</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-700">339</div>
              <div className="text-xs text-green-600">תורנויות</div>
            </div>
          </div>
        </div>

        {/* Debug Info */}
        <div className="mt-4 bg-gray-100 border border-gray-300 rounded-xl p-4">
          <h3 className="font-bold text-gray-700 mb-2 text-sm">🔧 Debug Info:</h3>
          <div className="text-xs text-gray-600 font-mono space-y-1">
            <div>API Endpoint: /api/on-call/current-legacy</div>
            <div>Using: contacts + duty_roster tables</div>
            <div>Current Day: {new Date().toLocaleDateString('he-IL', { weekday: 'long' })}</div>
            <div>Current Hour: {new Date().getHours()}:00</div>
          </div>
        </div>
      </div>
    </div>
  );
}
