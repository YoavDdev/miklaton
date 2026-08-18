'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import CallCenterExcelImporter from './CallCenterExcelImporter';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAYS_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

function formatDateForDB(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateShort(date) {
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

/**
 * canEdit: מאפשר עריכה נקודתית של שיבוץ בודד. עד היום הדרך היחידה לשנות
 * סידור היתה למחוק שבוע שלם ולייבא אקסל מחדש - גם כשהתחלף אדם אחד ברגע
 * האחרון. ה-API לשיבוץ בודד היה קיים כל הזמן בלי ממשק.
 */
export default function CallCenterSchedule({ departmentId, canEdit = false }) {
  const [adding, setAdding] = useState(null); // {shiftId, dayIdx, position}
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const [staff, setStaff] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(currentWeekStart);
    date.setDate(date.getDate() + i);
    return date;
  });

  const isCurrentWeek = formatDateForDB(currentWeekStart) === formatDateForDB(getWeekStart(new Date()));

  useEffect(() => {
    if (departmentId) {
      fetchStaff();
      fetchShifts();
    }
  }, [departmentId]);

  useEffect(() => {
    if (departmentId) {
      fetchSchedule();
    }
  }, [departmentId, currentWeekStart]);

  const fetchStaff = async () => {
    try {
      const res = await fetch(`/api/call-center-staff?department_id=${departmentId}`);
      const data = await res.json();
      if (data.success) setStaff(data.data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const fetchShifts = async () => {
    try {
      const res = await fetch(`/api/call-center-shifts?department_id=${departmentId}`);
      const data = await res.json();
      if (data.success) setShifts(data.data || []);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    }
  };

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const weekStartStr = formatDateForDB(currentWeekStart);
      const res = await fetch(`/api/call-center-schedule?department_id=${departmentId}&week_start=${weekStartStr}`);
      const data = await res.json();
      if (data.success) setSchedule(data.data || []);
    } catch (error) {
      console.error('Error fetching schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousWeek = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() - 7);
    setCurrentWeekStart(newWeekStart);
  };

  const goToNextWeek = () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() + 7);
    setCurrentWeekStart(newWeekStart);
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(getWeekStart(new Date()));
  };

  const getCellAssignments = (shiftId, dayIndex, position) => {
    return schedule.filter(s => 
      s.shift_id === shiftId && 
      s.day_of_week === dayIndex && 
      s.position === position
    );
  };

  const addAssignment = async (shiftId, dayIdx, position) => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch('/api/call-center-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          department_id: departmentId,
          shift_id: shiftId,
          week_start: formatDateForDB(currentWeekStart),
          day_of_week: dayIdx,
          position,
          staff_name: name,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setNewName('');
      setAdding(null);
      fetchSchedule();
    } catch (error) {
      toast.error('ההוספה נכשלה: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const removeAssignment = async (assignment) => {
    const who = assignment.staff?.full_name || assignment.staff_name || 'השיבוץ';
    if (!confirm(`להסיר את ${who} מהמשמרת?`)) return;
    try {
      const res = await fetch(`/api/call-center-schedule?id=${assignment.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      fetchSchedule();
    } catch (error) {
      toast.error('ההסרה נכשלה: ' + error.message);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Week Navigation */}
      <div className="bg-white rounded-lg shadow p-3 flex items-center justify-between">
        <button onClick={goToPreviousWeek} className="px-3 py-2 bg-blue-100 active:bg-blue-200 text-blue-700 rounded-lg font-bold text-sm">
          → שבוע קודם
        </button>
        <div className="text-center">
          <div className="text-sm font-bold text-gray-900">
            {formatDateShort(weekDates[0])} - {formatDateShort(weekDates[6])}/{weekDates[6].getFullYear()}
          </div>
          {!isCurrentWeek && (
            <button onClick={goToCurrentWeek} className="text-xs text-blue-600 font-semibold mt-1">
              חזור לשבוע הנוכחי
            </button>
          )}
        </div>
        <button onClick={goToNextWeek} className="px-3 py-2 bg-blue-100 active:bg-blue-200 text-blue-700 rounded-lg font-bold text-sm">
          שבוע הבא ←
        </button>
      </div>

      {/* Excel Import */}
      <div className="bg-gradient-to-l from-green-50 to-blue-50 border-2 border-green-200 rounded-lg p-4">
        <div className="mb-3">
          <h3 className="font-bold text-gray-900">📥 ייבוא מ-Excel</h3>
          <p className="text-xs text-gray-600 mt-1">העלה קובץ Excel של סידור המשמרות ועדכן אוטומטית את כל השבוע</p>
        </div>
        <CallCenterExcelImporter
          departmentId={departmentId}
          currentWeekStart={currentWeekStart}
          staff={staff}
          shifts={shifts}
          onImportComplete={fetchSchedule}
        />
      </div>

      {/* Schedule Table */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          <div className="text-4xl mb-3">⏳</div>
          <p>טוען...</p>
        </div>
      ) : shifts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          <div className="text-4xl mb-3">📞</div>
          <p className="font-semibold">אין משמרות מוגדרות</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="bg-gradient-to-l from-blue-600 to-purple-600 text-white p-3 text-center">
            <h2 className="text-lg font-bold">📞 סידור משמרות מוקד 106</h2>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir="rtl">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="p-2 text-right font-bold sticky right-0 bg-gray-100 border-l border-gray-300 w-32">משמרת</th>
                  <th className="p-2 text-right font-bold sticky right-32 bg-gray-100 border-l border-gray-300 w-20">תפקיד</th>
                  {DAYS.map((day, idx) => (
                    <th key={idx} className="p-2 text-center font-bold border-l border-gray-200 min-w-[120px]">
                      <div>{day}</div>
                      <div className="text-xs font-normal text-gray-600">{formatDateShort(weekDates[idx])}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift, shiftIdx) => (
                  <>
                    {/* Manager Row */}
                    <tr key={`${shift.id}-manager`} className="border-b hover:bg-blue-50">
                      <td className="p-2 font-semibold sticky right-0 bg-white border-l border-gray-300">
                        {shift.name}
                        <div className="text-xs text-gray-600">{shift.start_time}-{shift.end_time}</div>
                      </td>
                      <td className="p-2 text-xs sticky right-32 bg-white border-l border-gray-300">אחמ"ש</td>
                      {weekDates.map((_, dayIdx) => {
                        const assignments = getCellAssignments(shift.id, dayIdx, 'אחמ"ש');
                        return (
                          <td key={dayIdx} className="p-1 border-l border-gray-200 text-center">
                            {assignments.map((a, i) => (
                              <div key={i} className="text-xs bg-blue-100 text-blue-800 rounded px-1 py-0.5 mb-0.5 flex items-center justify-center gap-1 group">
                                <span>{a.staff?.full_name || a.staff_name}</span>
                                {canEdit && (
                                  <button
                                    onClick={() => removeAssignment(a)}
                                    title="הסר מהמשמרת"
                                    className="opacity-0 group-hover:opacity-100 text-red-600 font-bold leading-none"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                            {canEdit && (
                              adding?.shiftId === shift.id && adding?.dayIdx === dayIdx && adding?.position === 'אחמ"ש' ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    autoFocus
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') addAssignment(shift.id, dayIdx, 'אחמ"ש');
                                      if (e.key === 'Escape') { setAdding(null); setNewName(''); }
                                    }}
                                    placeholder="שם"
                                    className="w-full text-xs border border-gray-300 rounded px-1 py-0.5"
                                  />
                                  <button
                                    disabled={saving}
                                    onClick={() => addAssignment(shift.id, dayIdx, 'אחמ"ש')}
                                    className="text-xs text-green-700 font-bold"
                                  >
                                    ✓
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setAdding({ shiftId: shift.id, dayIdx, position: 'אחמ"ש' }); setNewName(''); }}
                                  title="הוסף שיבוץ"
                                  className="text-xs text-gray-400 hover:text-gray-700"
                                >
                                  +
                                </button>
                              )
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    {/* Representatives Rows */}
                    <tr key={`${shift.id}-rep`} className="border-b hover:bg-green-50">
                      <td className="p-2 sticky right-0 bg-white border-l border-gray-300"></td>
                      <td className="p-2 text-xs sticky right-32 bg-white border-l border-gray-300">נציגים</td>
                      {weekDates.map((_, dayIdx) => {
                        const assignments = getCellAssignments(shift.id, dayIdx, 'נציג');
                        return (
                          <td key={dayIdx} className="p-1 border-l border-gray-200 text-center">
                            {assignments.map((a, i) => (
                              <div key={i} className="text-xs bg-green-100 text-green-800 rounded px-1 py-0.5 mb-0.5 flex items-center justify-center gap-1 group">
                                <span>{a.staff?.full_name || a.staff_name}</span>
                                {canEdit && (
                                  <button
                                    onClick={() => removeAssignment(a)}
                                    title="הסר מהמשמרת"
                                    className="opacity-0 group-hover:opacity-100 text-red-600 font-bold leading-none"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                            {canEdit && (
                              adding?.shiftId === shift.id && adding?.dayIdx === dayIdx && adding?.position === 'נציג' ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    autoFocus
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') addAssignment(shift.id, dayIdx, 'נציג');
                                      if (e.key === 'Escape') { setAdding(null); setNewName(''); }
                                    }}
                                    placeholder="שם"
                                    className="w-full text-xs border border-gray-300 rounded px-1 py-0.5"
                                  />
                                  <button
                                    disabled={saving}
                                    onClick={() => addAssignment(shift.id, dayIdx, 'נציג')}
                                    className="text-xs text-green-700 font-bold"
                                  >
                                    ✓
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setAdding({ shiftId: shift.id, dayIdx, position: 'נציג' }); setNewName(''); }}
                                  title="הוסף שיבוץ"
                                  className="text-xs text-gray-400 hover:text-gray-700"
                                >
                                  +
                                </button>
                              )
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    {shiftIdx < shifts.length - 1 && (
                      <tr>
                        <td colSpan={9} className="h-2 bg-gray-100"></td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
