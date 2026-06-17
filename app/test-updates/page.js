'use client';

import DailyUpdatesPanel from '@/components/DailyUpdatesPanel';

/**
 * דף בדיקה לרכיב DailyUpdatesPanel
 */
export default function TestUpdatesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🧪 בדיקת רכיב עדכונים יומיומיים
          </h1>
          <p className="text-gray-600">
            דף זה מציג את רכיב DailyUpdatesPanel החדש
          </p>
        </div>

        {/* Component */}
        <DailyUpdatesPanel canEdit={true} />

        {/* Info */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="font-bold text-blue-900 mb-2">💡 מידע:</h3>
          <ul className="text-blue-700 text-sm space-y-1">
            <li>• הרכיב מציג עדכונים פעילים כרגע (לפי זמן התחלה/סיום)</li>
            <li>• ניתן להוסיף עדכון חדש בלחיצה על "➕ הוסף"</li>
            <li>• סוגי עדכונים: חסימת כביש, אירוע, תחזוקה, התראה, אחר</li>
            <li>• היסטוריה זמינה אבל לא מוצגת בברירת מחדל</li>
            <li>• הרכיב מתעדכן אוטומטית כל 5 דקות</li>
          </ul>
        </div>

        {/* Example Data */}
        <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
          <h3 className="font-bold text-green-900 mb-2">📝 דוגמה לעדכון:</h3>
          <div className="text-green-700 text-sm space-y-1">
            <div><strong>כותרת:</strong> חסימת רחוב הרצל</div>
            <div><strong>תיאור:</strong> עבודות תשתית - חסימה חלקית</div>
            <div><strong>סוג:</strong> חסימת כביש</div>
            <div><strong>כתובת:</strong> רחוב הרצל 15, יהוד</div>
            <div><strong>זמן:</strong> היום 08:00 - מחר 18:00</div>
          </div>
        </div>

        {/* Debug Info */}
        <div className="mt-4 bg-gray-100 border border-gray-300 rounded-xl p-4">
          <h3 className="font-bold text-gray-700 mb-2 text-sm">🔧 Debug Info:</h3>
          <div className="text-xs text-gray-600 font-mono space-y-1">
            <div>API Endpoint: /api/daily-updates</div>
            <div>Methods: GET (list), POST (create), PUT (update), DELETE (delete)</div>
            <div>Can Edit: true (מוקדן/מנהל מוקד)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
