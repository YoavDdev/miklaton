'use client';

import { useState } from 'react';

/**
 * ShiftScheduler - לוח משמרות שבועי ויזואלי
 * מציג ומאפשר עריכה של משמרות כוננות
 */
export default function ShiftScheduler({ departmentId, contacts, shifts, onAddShift, onDeleteShift }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);

  const DAYS = [
    { value: 0, label: 'ראשון', short: 'א\'' },
    { value: 1, label: 'שני', short: 'ב\'' },
    { value: 2, label: 'שלישי', short: 'ג\'' },
    { value: 3, label: 'רביעי', short: 'ד\'' },
    { value: 4, label: 'חמישי', short: 'ה\'' },
    { value: 5, label: 'שישי', short: 'ו\'' },
    { value: 6, label: 'שבת', short: 'ש\'' }
  ];

  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  // Get shifts for a specific day and hour
  const getShiftsForSlot = (day, hour) => {
    return shifts.filter(shift => {
      // Check if day is included
      if (!shift.days_of_week.includes(day)) return false;

      // If no time specified, it's all day
      if (!shift.time_start && !shift.time_end) return true;

      // Parse times
      const startHour = shift.time_start ? parseInt(shift.time_start.split(':')[0]) : 0;
      const endHour = shift.time_end ? parseInt(shift.time_end.split(':')[0]) : 24;

      // Check if hour is in range
      if (startHour < endHour) {
        return hour >= startHour && hour < endHour;
      } else {
        // Overnight shift
        return hour >= startHour || hour < endHour;
      }
    });
  };

  // Get contact by ID
  const getContact = (contactId) => {
    return contacts.find(c => c.id === contactId);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
        <h3 className="text-xl font-bold text-white">📅 לוח משמרות שבועי</h3>
        <p className="text-purple-100 text-sm">תצוגה ויזואלית של כל המשמרות</p>
      </div>

      <div className="p-6">
        {/* Weekly Grid */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-gray-300 bg-gray-50 p-2 text-sm font-bold sticky right-0">
                  שעה
                </th>
                {DAYS.map(day => (
                  <th key={day.value} className="border border-gray-300 bg-gray-50 p-2 text-sm font-bold min-w-[120px]">
                    {day.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map(hour => (
                <tr key={hour}>
                  <td className="border border-gray-300 bg-gray-50 p-2 text-sm font-medium text-center sticky right-0">
                    {hour.toString().padStart(2, '0')}:00
                  </td>
                  {DAYS.map(day => {
                    const shiftsInSlot = getShiftsForSlot(day.value, hour);
                    return (
                      <td
                        key={`${day.value}-${hour}`}
                        className={`border border-gray-300 p-1 text-xs ${
                          shiftsInSlot.length > 0 ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
                        } cursor-pointer transition-colors`}
                        onClick={() => {
                          setSelectedDay(day.value);
                          setSelectedTime(hour);
                        }}
                      >
                        {shiftsInSlot.map((shift, idx) => {
                          const contact = getContact(shift.contact_id);
                          return (
                            <div
                              key={idx}
                              className="bg-blue-600 text-white rounded px-2 py-1 mb-1 text-center"
                              title={contact?.name}
                            >
                              {contact?.name?.split(' ')[0] || 'לא ידוע'}
                            </div>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-600 rounded"></div>
            <span>משמרת פעילה</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-white border border-gray-300 rounded"></div>
            <span>ללא כיסוי</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{contacts.length}</div>
            <div className="text-sm text-gray-600">כוננים</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{shifts.length}</div>
            <div className="text-sm text-gray-600">משמרות</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {Math.round((shifts.length / (7 * 24)) * 100)}%
            </div>
            <div className="text-sm text-gray-600">כיסוי</div>
          </div>
        </div>
      </div>
    </div>
  );
}
