'use client';

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

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

export default function SecurityWeeklySchedule({ departmentId }) {
  const [activeTab, setActiveTab] = useState('schedule');
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const [staff, setStaff] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staffForm, setStaffForm] = useState({ full_name: '', phone: '', role: 'פיקוח' });
  const [editingStaff, setEditingStaff] = useState(null);

  const [showShiftForm, setShowShiftForm] = useState(false);
  const [shiftForm, setShiftForm] = useState({ name: '', category: 'פיקוח', start_time: '08:00', end_time: '16:00' });
  const [editingShift, setEditingShift] = useState(null);

  // Inline cell popup
  const [activeCell, setActiveCell] = useState(null); // { shiftId, dayIndex }
  const popupRef = useRef(null);

  // Week dates
  const getWeekDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  };
  const weekDates = getWeekDates();

  // Close popup on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setActiveCell(null);
      }
    };
    if (activeCell) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [activeCell]);

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
      const res = await fetch(`/api/security-staff?department_id=${departmentId}`);
      const data = await res.json();
      if (data.success) setStaff(data.data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const fetchShifts = async () => {
    try {
      const res = await fetch(`/api/security-shifts?department_id=${departmentId}`);
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
      const res = await fetch(`/api/security-schedule?department_id=${departmentId}&week_start=${weekStartStr}`);
      const data = await res.json();
      if (data.success) setSchedule(data.data || []);
    } catch (error) {
      console.error('Error fetching schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  // Staff CRUD
  const handleSaveStaff = async () => {
    if (!staffForm.full_name.trim()) { toast.error('נא להזין שם'); return; }
    try {
      const method = editingStaff ? 'PATCH' : 'POST';
      const body = editingStaff 
        ? { id: editingStaff.id, ...staffForm }
        : { department_id: departmentId, ...staffForm };
      const res = await fetch('/api/security-staff', {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editingStaff ? 'עובד עודכן ✅' : 'עובד נוסף ✅');
        setShowStaffForm(false); setEditingStaff(null);
        setStaffForm({ full_name: '', phone: '', role: 'פיקוח' });
        fetchStaff();
      } else { toast.error(data.error); }
    } catch { toast.error('שגיאה בשמירה'); }
  };

  const handleDeleteStaff = async (id) => {
    if (!confirm('למחוק עובד זה?')) return;
    const res = await fetch(`/api/security-staff?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) { toast.success('עובד הוסר'); fetchStaff(); }
  };

  // Shifts CRUD
  const handleSaveShift = async () => {
    if (!shiftForm.name.trim() || !shiftForm.start_time || !shiftForm.end_time) {
      toast.error('נא למלא את כל השדות'); return;
    }
    try {
      const method = editingShift ? 'PATCH' : 'POST';
      const body = editingShift 
        ? { id: editingShift.id, ...shiftForm }
        : { department_id: departmentId, ...shiftForm };
      const res = await fetch('/api/security-shifts', {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editingShift ? 'משמרת עודכנה ✅' : 'משמרת נוספה ✅');
        setShowShiftForm(false); setEditingShift(null);
        setShiftForm({ name: '', category: 'פיקוח', start_time: '08:00', end_time: '16:00' });
        fetchShifts();
      } else { toast.error(data.error); }
    } catch { toast.error('שגיאה בשמירה'); }
  };

  const handleDeleteShift = async (id) => {
    if (!confirm('למחוק משמרת זו?')) return;
    const res = await fetch(`/api/security-shifts?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) { toast.success('משמרת הוסרה'); fetchShifts(); }
  };

  // Schedule - assign staff to cell
  const handleAssign = async (shiftId, dayIndex, staffId, isBackup = false) => {
    const weekStartStr = formatDateForDB(currentWeekStart);
    try {
      const res = await fetch('/api/security-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department_id: departmentId,
          shift_id: shiftId,
          staff_id: staffId,
          week_start: weekStartStr,
          day_of_week: dayIndex,
          is_backup: isBackup
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('שובץ ✅');
        fetchSchedule();
      } else { toast.error(data.error); }
    } catch { toast.error('שגיאה בשיבוץ'); }
  };

  const handleRemoveAssignment = async (entryId) => {
    try {
      const res = await fetch(`/api/security-schedule?id=${entryId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { fetchSchedule(); }
    } catch { toast.error('שגיאה'); }
  };

  // Get assignments for a specific cell
  const getCellAssignments = (shiftId, dayIndex) => {
    return schedule.filter(s => s.shift_id === shiftId && s.day_of_week === dayIndex);
  };

  // Navigation
  const goToPreviousWeek = () => {
    const d = new Date(currentWeekStart); d.setDate(d.getDate() - 7); setCurrentWeekStart(d);
  };
  const goToNextWeek = () => {
    const d = new Date(currentWeekStart); d.setDate(d.getDate() + 7); setCurrentWeekStart(d);
  };
  const goToCurrentWeek = () => { setCurrentWeekStart(getWeekStart(new Date())); };

  const isCurrentWeek = formatDateForDB(currentWeekStart) === formatDateForDB(getWeekStart(new Date()));

  // Group shifts by category
  const pikuachShifts = shifts.filter(s => s.category === 'פיקוח');
  const shitturShifts = shifts.filter(s => s.category === 'שיטור');

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="flex -mb-px min-w-max">
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'schedule' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📋 סידור עבודה שבועי
            </button>
            <button
              onClick={() => setActiveTab('staff')}
              className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'staff' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              👥 עובדים ({staff.length})
            </button>
            <button
              onClick={() => setActiveTab('shifts')}
              className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'shifts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              ⏰ משמרות ({shifts.length})
            </button>
          </nav>
        </div>
      </div>

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
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

          {/* Schedule Tables */}
          {shifts.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              <div className="text-4xl mb-3">⏰</div>
              <p className="font-semibold">אין משמרות מוגדרות</p>
              <p className="text-sm mt-1">עבור ללשונית &quot;משמרות&quot; כדי להגדיר סוגי משמרות</p>
            </div>
          ) : (
            <>
              {/* Pikuach Table */}
              {pikuachShifts.length > 0 && (
                <ExcelTable
                  title="סידור עבודה שבועי פיקוח עירוני"
                  titleBg="from-yellow-400 to-yellow-500"
                  shifts={pikuachShifts}
                  weekDates={weekDates}
                  staff={staff.filter(s => s.role === 'פיקוח')}
                  allStaff={staff}
                  getCellAssignments={getCellAssignments}
                  activeCell={activeCell}
                  setActiveCell={setActiveCell}
                  popupRef={popupRef}
                  onAssign={handleAssign}
                  onRemove={handleRemoveAssignment}
                  category="פיקוח"
                />
              )}

              {/* Shitur Table */}
              {shitturShifts.length > 0 && (
                <ExcelTable
                  title="סידור עבודה שבועי שיטור עירוני"
                  titleBg="from-yellow-400 to-yellow-500"
                  shifts={shitturShifts}
                  weekDates={weekDates}
                  staff={staff.filter(s => s.role === 'שיטור')}
                  allStaff={staff}
                  getCellAssignments={getCellAssignments}
                  activeCell={activeCell}
                  setActiveCell={setActiveCell}
                  popupRef={popupRef}
                  onAssign={handleAssign}
                  onRemove={handleRemoveAssignment}
                  category="שיטור"
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Staff Tab */}
      {activeTab === 'staff' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">👥 עובדים</h3>
            <button
              onClick={() => { setShowStaffForm(true); setEditingStaff(null); setStaffForm({ full_name: '', phone: '', role: 'פיקוח' }); }}
              className="px-4 py-2 bg-green-600 active:bg-green-700 text-white rounded-lg font-semibold text-sm"
            >
              + הוסף עובד
            </button>
          </div>

          {showStaffForm && (
            <div className="p-4 bg-blue-50 border-b-2 border-blue-200">
              <h4 className="font-bold mb-3">{editingStaff ? 'ערוך עובד' : 'עובד חדש'}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <input type="text" placeholder="שם מלא *" value={staffForm.full_name}
                  onChange={(e) => setStaffForm({ ...staffForm, full_name: e.target.value })}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none" />
                <input type="text" placeholder="טלפון" value={staffForm.phone}
                  onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none" />
                <select value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none">
                  <option value="פיקוח">פיקוח</option>
                  <option value="שיטור">שיטור</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveStaff} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm">
                  {editingStaff ? '✅ עדכן' : '➕ הוסף'}
                </button>
                <button onClick={() => { setShowStaffForm(false); setEditingStaff(null); }} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold text-sm">
                  ביטול
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-gray-100">
            {staff.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <div className="text-4xl mb-2">👥</div>
                <p>אין עובדים. הוסף עובד ראשון כדי להתחיל.</p>
              </div>
            ) : (
              ['פיקוח', 'שיטור'].map(role => {
                const roleStaff = staff.filter(s => s.role === role);
                if (roleStaff.length === 0) return null;
                return (
                  <div key={role}>
                    <div className="px-4 py-2 bg-gray-50 text-sm font-bold text-gray-700">
                      {role === 'פיקוח' ? '🔍 פיקוח' : '🚔 שיטור'} ({roleStaff.length})
                    </div>
                    {roleStaff.map(member => (
                      <div key={member.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                        <div>
                          <span className="font-semibold text-gray-900">{member.full_name}</span>
                          {member.phone && <span className="text-sm text-gray-500 mr-2">📞 {member.phone}</span>}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingStaff(member); setStaffForm({ full_name: member.full_name, phone: member.phone || '', role: member.role }); setShowStaffForm(true); }}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded font-semibold">✏️</button>
                          <button onClick={() => handleDeleteStaff(member.id)}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded font-semibold">🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Shifts Tab */}
      {activeTab === 'shifts' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">⏰ סוגי משמרות</h3>
            <button
              onClick={() => { setShowShiftForm(true); setEditingShift(null); setShiftForm({ name: '', category: 'פיקוח', start_time: '08:00', end_time: '16:00' }); }}
              className="px-4 py-2 bg-green-600 active:bg-green-700 text-white rounded-lg font-semibold text-sm"
            >
              + הוסף משמרת
            </button>
          </div>

          {showShiftForm && (
            <div className="p-4 bg-blue-50 border-b-2 border-blue-200">
              <h4 className="font-bold mb-3">{editingShift ? 'ערוך משמרת' : 'משמרת חדשה'}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
                <input type="text" placeholder="שם המשמרת *" value={shiftForm.name}
                  onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none" />
                <select value={shiftForm.category} onChange={(e) => setShiftForm({ ...shiftForm, category: e.target.value })}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none">
                  <option value="פיקוח">פיקוח</option>
                  <option value="שיטור">שיטור</option>
                </select>
                <input type="time" value={shiftForm.start_time}
                  onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none" />
                <input type="time" value={shiftForm.end_time}
                  onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveShift} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm">
                  {editingShift ? '✅ עדכן' : '➕ הוסף'}
                </button>
                <button onClick={() => { setShowShiftForm(false); setEditingShift(null); }} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold text-sm">
                  ביטול
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-gray-100">
            {shifts.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <div className="text-4xl mb-2">⏰</div>
                <p>אין משמרות מוגדרות. הוסף משמרת ראשונה.</p>
              </div>
            ) : (
              ['פיקוח', 'שיטור'].map(category => {
                const catShifts = shifts.filter(s => s.category === category);
                if (catShifts.length === 0) return null;
                return (
                  <div key={category}>
                    <div className="px-4 py-2 bg-gray-50 text-sm font-bold text-gray-700">
                      {category === 'פיקוח' ? '🔍 פיקוח' : '🚔 שיטור'} ({catShifts.length})
                    </div>
                    {catShifts.map(shift => (
                      <div key={shift.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                        <div>
                          <span className="font-semibold text-gray-900">{shift.name}</span>
                          <span className="text-sm text-gray-500 mr-2">{shift.start_time} - {shift.end_time}</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingShift(shift); setShiftForm({ name: shift.name, category: shift.category, start_time: shift.start_time, end_time: shift.end_time }); setShowShiftForm(true); }}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded font-semibold">✏️</button>
                          <button onClick={() => handleDeleteShift(shift.id)}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded font-semibold">🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Excel-style Schedule Table ───────────────────────────────────────
function ExcelTable({ title, titleBg, shifts, weekDates, staff, allStaff, getCellAssignments, activeCell, setActiveCell, popupRef, onAssign, onRemove, category }) {
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
      {/* Title bar like the image */}
      <div className={`bg-gradient-to-l ${titleBg} px-4 py-2.5 text-center`}>
        <h3 className="text-sm sm:text-base font-black text-gray-900">{title}</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse" dir="rtl">
          <thead>
            <tr className="bg-yellow-100">
              {/* Shift column header (rightmost - RTL) */}
              <th className="border border-gray-300 px-2 py-2 text-center text-xs sm:text-sm font-bold text-gray-800 min-w-[80px] sm:min-w-[110px] sticky right-0 bg-yellow-100 z-10">
                משמרות
              </th>
              {/* Day headers */}
              <th className="border border-gray-300 px-1 py-2 text-center text-xs sm:text-sm font-bold text-gray-800 min-w-[70px] sm:min-w-[100px]">
                מתלול
              </th>
              {/* Days from Sunday (right) to Saturday (left) */}
              {weekDates.map((date, i) => (
                <th key={i} className="border border-gray-300 px-1 py-2 text-center text-xs font-bold text-gray-800 min-w-[80px] sm:min-w-[110px]">
                  <div className="text-xs sm:text-sm">יום {DAYS_SHORT[i]}</div>
                  <div className="text-[10px] sm:text-xs text-gray-600">{formatDateShort(date)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shifts.map((shift) => (
              <tr key={shift.id} className="hover:bg-blue-50/20">
                {/* Shift time - rightmost sticky column */}
                <td className="border border-gray-300 px-2 py-2 sticky right-0 bg-white z-10">
                  <div className="text-xs sm:text-sm font-bold text-gray-900 text-center whitespace-nowrap">
                    {shift.start_time}-{shift.end_time}
                  </div>
                </td>
                {/* Category cell */}
                <td className="border border-gray-300 px-1 py-1 text-center">
                  <span className="text-[10px] sm:text-xs font-semibold text-gray-600">{shift.name}</span>
                </td>
                {/* Day cells - editable */}
                {weekDates.map((_, dayIdx) => {
                  const entries = getCellAssignments(shift.id, dayIdx);
                  const cellKey = `${category}-${shift.id}-${dayIdx}`;
                  const isActive = activeCell === cellKey;

                  return (
                    <td key={dayIdx} className="border border-gray-300 p-0 relative align-top">
                      <div
                        onClick={() => setActiveCell(isActive ? null : cellKey)}
                        className={`min-h-[44px] sm:min-h-[52px] p-1 cursor-pointer transition-colors ${
                          isActive ? 'bg-blue-100 ring-2 ring-blue-500 ring-inset' : 'hover:bg-gray-50 active:bg-blue-50'
                        }`}
                      >
                        {entries.length === 0 ? (
                          <div className="flex items-center justify-center h-full min-h-[40px]">
                            <span className="text-gray-300 text-sm">+</span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            {entries.map(entry => (
                              <div key={entry.id} className={`text-[10px] sm:text-xs font-semibold px-1 py-0.5 rounded text-center leading-tight ${
                                entry.is_backup 
                                  ? 'text-orange-700' 
                                  : 'text-gray-900'
                              }`}>
                                {entry.staff?.full_name}
                                {entry.is_backup && <span className="text-[9px] text-orange-600"> (חלופי)</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Inline Popup */}
                      {isActive && (
                        <div
                          ref={popupRef}
                          className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 w-48 sm:w-56 bg-white rounded-lg shadow-xl border-2 border-blue-300 overflow-hidden"
                          style={{ maxHeight: '280px' }}
                        >
                          {/* Existing assignments */}
                          {entries.length > 0 && (
                            <div className="p-2 bg-gray-50 border-b border-gray-200">
                              {entries.map(entry => (
                                <div key={entry.id} className="flex items-center justify-between py-0.5">
                                  <span className="text-xs font-medium text-gray-800">
                                    {entry.staff?.full_name} {entry.is_backup ? '(חלופי)' : ''}
                                  </span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }}
                                    className="text-red-500 text-xs font-bold px-1 hover:text-red-700"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Staff list to pick from */}
                          <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
                            {staff.length === 0 ? (
                              <p className="text-xs text-gray-400 p-3 text-center">אין עובדים</p>
                            ) : (
                              staff.map(member => {
                                const alreadyHere = entries.some(e => e.staff_id === member.id);
                                if (alreadyHere) return null;
                                return (
                                  <div key={member.id} className="border-b border-gray-100 last:border-0">
                                    <div className="flex items-center justify-between px-2 py-1.5 hover:bg-blue-50">
                                      <span className="text-xs font-medium text-gray-800">{member.full_name}</span>
                                      <div className="flex gap-1">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); onAssign(shift.id, dayIdx, member.id, false); }}
                                          className="px-2 py-0.5 bg-blue-600 text-white text-[10px] rounded font-bold"
                                        >
                                          ראשי
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); onAssign(shift.id, dayIdx, member.id, true); }}
                                          className="px-2 py-0.5 bg-orange-500 text-white text-[10px] rounded font-bold"
                                        >
                                          חלופי
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
