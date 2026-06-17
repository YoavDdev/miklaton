'use client';

import { useState, useEffect } from 'react';
import DailyOnCallManager from '@/components/DailyOnCallManager';
import ShiftScheduler from '@/components/ShiftScheduler';

export default function TestDailyOnCallPage() {
  const [activeTab, setActiveTab] = useState('manager');

  // Clear old localStorage on mount
  useEffect(() => {
    const oldId = localStorage.getItem('municipality_id');
    if (oldId === '1') {
      localStorage.removeItem('municipality_id');
      console.log('Cleared old municipality_id');
    }
  }, []);

  // Mock data for testing
  const mockContacts = [
    { id: '1', name: 'מאור אייש', phone: '050-1234567', priority: 1 },
    { id: '2', name: 'דני כהן', phone: '050-9876543', priority: 2 },
    { id: '3', name: 'רועי לוי', phone: '050-5555555', priority: 3 }
  ];

  const mockShifts = [
    {
      id: '1',
      contact_id: '1',
      days_of_week: [0, 1, 2, 3, 4],
      time_start: '08:00',
      time_end: '16:00',
      description: 'משמרת בוקר'
    },
    {
      id: '2',
      contact_id: '2',
      days_of_week: [0, 1, 2, 3, 4],
      time_start: '16:00',
      time_end: '00:00',
      description: 'משמרת אחה"צ'
    },
    {
      id: '3',
      contact_id: '3',
      days_of_week: [5, 6],
      time_start: null,
      time_end: null,
      description: 'כל היום - סופ"ש'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🧪 בדיקת מערכת כוננים יומיומית
          </h1>
          <p className="text-gray-600">
            דף בדיקה לניהול כוננים ומשמרות
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('manager')}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                activeTab === 'manager'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              👥 ניהול כוננים
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                activeTab === 'schedule'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              📅 לוח משמרות
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'manager' && <DailyOnCallManager />}
            {activeTab === 'schedule' && (
              <ShiftScheduler
                departmentId="1"
                contacts={mockContacts}
                shifts={mockShifts}
                onAddShift={() => {}}
                onDeleteShift={() => {}}
              />
            )}
          </div>
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="font-bold text-blue-900 mb-2">💡 מידע:</h3>
          <ul className="text-blue-700 text-sm space-y-1">
            <li>• <strong>ניהול כוננים</strong> - הוספה ועריכה של אנשי קשר</li>
            <li>• <strong>לוח משמרות</strong> - תצוגה ויזואלית של כל המשמרות השבועיות</li>
            <li>• כל יום יכול להיות מספר כוננים במשמרות שונות</li>
            <li>• המערכת מחשבת אוטומטית מי כונן עכשיו לפי יום ושעה</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
