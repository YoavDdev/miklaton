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

  // Settings (vehicles, task templates)
  const [settings, setSettings] = useState({ vehicles: [], tasks_pikuach: [], tasks_shitur: [] });

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
      fetchSettings();
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

  const fetchSettings = async () => {
    try {
      const res = await fetch(`/api/security-settings?department_id=${departmentId}`);
      const data = await res.json();
      if (data.success) setSettings(data.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
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
              onClick={() => setActiveTab('daily-order')}
              className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'daily-order' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📝 פקודת יום
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
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'settings' ? 'border-gray-600 text-gray-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              ⚙️ הגדרות
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

      {/* Daily Order Tab */}
      {activeTab === 'daily-order' && (
        <DailyOrderTab departmentId={departmentId} staff={staff} schedule={schedule} shifts={shifts} currentWeekStart={currentWeekStart} settings={settings} />
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <SettingsTab departmentId={departmentId} settings={settings} onSettingsChange={(s) => { setSettings(s); }} />
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

// ─── Daily Order Tab ──────────────────────────────────────────────────
const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const FALLBACK_VEHICLES = ['קשקאי', 'חלופי', 'אופנוע', 'ניסאן שיטור'];
const FALLBACK_TASKS_PIKUACH = [
  'טיפול בפניות 106',
  'סיורי נוכחות בולטות',
  'אכיפת כלבים',
  'אכיפת שטחים נטושים',
  'אכיפת רכבים נטושים',
  'אכיפת אתרי בנייה',
];
const FALLBACK_TASKS_SHITUR = [
  'סיור שיטור',
  'טיפול באירועים',
  'סיורי נוכחות',
];

function DailyOrderTab({ departmentId, staff, schedule, shifts, currentWeekStart, settings }) {
  const vehicles = settings?.vehicles?.length > 0 ? settings.vehicles : FALLBACK_VEHICLES;
  const tasksPikuach = settings?.tasks_pikuach?.length > 0 ? settings.tasks_pikuach : FALLBACK_TASKS_PIKUACH;
  const tasksShitur = settings?.tasks_shitur?.length > 0 ? settings.tasks_shitur : FALLBACK_TASKS_SHITUR;
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDateForDB(tomorrow);
  });
  const [entries, setEntries] = useState([]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [signoffMessage, setSignoffMessage] = useState('יום טוב לכולם, סעו בזהירות, שמרו על עצמכם');
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load order when date changes
  useEffect(() => {
    if (departmentId && selectedDate) {
      loadOrder();
    }
  }, [departmentId, selectedDate]);

  const loadOrder = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/security-daily-order?department_id=${departmentId}&order_date=${selectedDate}`);
      const data = await res.json();
      if (data.success && data.data) {
        setGeneralNotes(data.data.general_notes || '');
        setSignoffMessage(data.data.signoff_message || 'יום טוב לכולם, סעו בזהירות, שמרו על עצמכם');
        setEntries(data.entries.map(e => ({
          ...e,
          tasks: e.tasks || []
        })));
      } else {
        // Try to pull from weekly schedule
        pullFromWeeklySchedule();
      }
    } catch (error) {
      console.error('Error loading daily order:', error);
    } finally {
      setLoading(false);
    }
  };

  const pullFromWeeklySchedule = () => {
    const date = new Date(selectedDate + 'T00:00:00');
    const dayOfWeek = date.getDay();
    
    // Find entries from the weekly schedule for this day
    const dayEntries = schedule.filter(s => s.day_of_week === dayOfWeek);
    
    if (dayEntries.length === 0) {
      setEntries([]);
      return;
    }

    const newEntries = dayEntries.map((entry, idx) => {
      const shift = shifts.find(s => s.id === entry.shift_id);
      const staffMember = staff.find(s => s.id === entry.staff_id);
      const category = shift?.category || staffMember?.role || 'פיקוח';
      
      return {
        id: `new-${idx}`,
        staff_id: entry.staff_id,
        staff_name: staffMember?.full_name || '',
        category,
        role_title: category === 'שיטור' ? 'שיטור עירוני' : 'פיקוח עירוני',
        vehicle: '',
        start_time: shift?.start_time || '07:00',
        end_time: shift?.end_time || '15:00',
        is_backup: entry.is_backup || false,
        tasks: [],
        special_notes: '',
        display_order: idx
      };
    });

    setEntries(newEntries);
  };

  const addEntry = (category = 'פיקוח') => {
    setEntries([...entries, {
      id: `new-${Date.now()}`,
      staff_id: null,
      staff_name: '',
      category,
      role_title: category === 'שיטור' ? 'שיטור עירוני' : 'פיקוח עירוני',
      vehicle: '',
      start_time: '07:00',
      end_time: '15:00',
      is_backup: false,
      tasks: [],
      special_notes: '',
      display_order: entries.length
    }]);
  };

  const updateEntry = (idx, field, value) => {
    const updated = [...entries];
    updated[idx] = { ...updated[idx], [field]: value };
    // If staff changed, update staff_name
    if (field === 'staff_id') {
      const member = staff.find(s => s.id === value);
      updated[idx].staff_name = member?.full_name || '';
    }
    setEntries(updated);
    setSaved(false);
  };

  const removeEntry = (idx) => {
    setEntries(entries.filter((_, i) => i !== idx));
    setSaved(false);
  };

  const addTask = (entryIdx, task) => {
    const updated = [...entries];
    updated[entryIdx].tasks = [...(updated[entryIdx].tasks || []), task];
    setEntries(updated);
    setSaved(false);
  };

  const removeTask = (entryIdx, taskIdx) => {
    const updated = [...entries];
    updated[entryIdx].tasks = updated[entryIdx].tasks.filter((_, i) => i !== taskIdx);
    setEntries(updated);
    setSaved(false);
  };

  const updateTask = (entryIdx, taskIdx, value) => {
    const updated = [...entries];
    updated[entryIdx].tasks[taskIdx] = value;
    setEntries(updated);
    setSaved(false);
  };

  const saveOrder = async () => {
    try {
      const res = await fetch('/api/security-daily-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department_id: departmentId,
          order_date: selectedDate,
          general_notes: generalNotes,
          signoff_message: signoffMessage,
          entries: entries.map(e => ({
            staff_id: e.staff_id,
            staff_name: e.staff_name,
            category: e.category,
            role_title: e.role_title,
            vehicle: e.vehicle,
            start_time: e.start_time,
            end_time: e.end_time,
            is_backup: e.is_backup,
            tasks: e.tasks,
            special_notes: e.special_notes
          }))
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('פקודת יום נשמרה ✅');
        setSaved(true);
      } else {
        toast.error(data.error);
      }
    } catch { toast.error('שגיאה בשמירה'); }
  };

  // Generate WhatsApp-formatted message
  const generateMessage = () => {
    const msgDate = new Date(selectedDate + 'T00:00:00');
    const msgDayName = HEBREW_DAYS[msgDate.getDay()];
    const dateStr = `${msgDate.getDate()}/${msgDate.getMonth() + 1}/${msgDate.getFullYear()}`;
    
    let msg = `יום ${msgDayName}, ${dateStr}\n`;
    msg += `🌅 *משמרת בוקר*\n\n`;

    // Pikuach entries
    const msgPikuach = entries.filter(e => e.category === 'פיקוח');
    const msgShitur = entries.filter(e => e.category === 'שיטור');

    msgPikuach.forEach(entry => {
      const name = entry.staff_name || 'לא שובץ';
      const vehicleStr = entry.vehicle ? ` (${entry.is_backup ? '*חלופי*' : ''}${entry.vehicle && entry.vehicle !== 'חלופי' ? `*${entry.vehicle}*` : ''})`.replace('()', '') : (entry.is_backup ? ' (*חלופי*)' : '');
      msg += `${name} | ${entry.role_title}${vehicleStr}\n`;
      msg += `${entry.start_time} עד ${entry.end_time}\n`;
      if (entry.vehicle && entry.vehicle !== 'חלופי') {
        msg += `*${entry.vehicle}*\n`;
      }
      if (entry.tasks && entry.tasks.length > 0) {
        entry.tasks.forEach(task => {
          msg += `${task}\n`;
        });
      }
      if (entry.special_notes) {
        msg += `*${entry.special_notes}*\n`;
      }
      msg += `\n`;
    });

    if (generalNotes) {
      msg += `${generalNotes}\n\n`;
    }

    if (msgShitur.length > 0) {
      msg += `שיטור עירוני:\n`;
      msgShitur.forEach(entry => {
        const name = entry.staff_name || 'לא שובץ';
        const shiftLabel = entry.start_time <= '10:00' ? 'משמרת בוקר' : 
                          entry.start_time <= '16:00' ? 'משמרת צהריים' : 'מתואמת לילה';
        msg += `${name} - ${shiftLabel} (${entry.start_time} עד ${entry.end_time})\n`;
      });
      msg += `\n`;
    }

    msg += `${signoffMessage} 🇮🇱`;
    return msg;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateMessage());
    toast.success('הודעה הועתקה ללוח! 📋');
  };

  const pikuachEntries = entries.filter(e => e.category === 'פיקוח');
  const shiturEntries = entries.filter(e => e.category === 'שיטור');

  const date = new Date(selectedDate + 'T00:00:00');
  const dayName = HEBREW_DAYS[date.getDay()];

  return (
    <div className="space-y-4">
      {/* Date selector + actions */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="font-bold text-gray-700 text-sm">📅 תאריך:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm font-semibold"
            />
            <span className="text-sm font-semibold text-gray-600">יום {dayName}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={saveOrder} className={`px-4 py-2 rounded-lg font-semibold text-sm ${saved ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white active:bg-blue-700'}`}>
              {saved ? '✅ נשמר' : '💾 שמור'}
            </button>
            <button onClick={() => setShowPreview(!showPreview)} className="px-4 py-2 bg-green-600 active:bg-green-700 text-white rounded-lg font-semibold text-sm">
              {showPreview ? '✏️ עריכה' : '👁️ תצוגה'}
            </button>
            <button onClick={copyToClipboard} className="px-4 py-2 bg-purple-600 active:bg-purple-700 text-white rounded-lg font-semibold text-sm">
              📋 העתק
            </button>
          </div>
        </div>
      </div>

      {/* Preview mode */}
      {showPreview ? (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap text-right leading-relaxed border-2 border-gray-200" dir="rtl">
            {generateMessage()}
          </div>
        </div>
      ) : (
        <>
          {/* Pikuach Section */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 bg-blue-50 border-b-2 border-blue-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm">🔍 פיקוח עירוני ({pikuachEntries.length})</h3>
              <button onClick={() => addEntry('פיקוח')} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold">
                + הוסף עובד
              </button>
            </div>
            
            <div className="divide-y divide-gray-100">
              {pikuachEntries.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">
                  אין שיבוצים. לחץ &quot;+ הוסף עובד&quot; או עבור לטאב סידור שבועי כדי למשוך אוטומטית.
                </div>
              ) : (
                pikuachEntries.map((entry, idx) => {
                  const realIdx = entries.indexOf(entry);
                  return (
                    <DailyEntryCard
                      key={entry.id || idx}
                      entry={entry}
                      idx={realIdx}
                      staff={staff}
                      vehicles={vehicles}
                      availableTasks={tasksPikuach}
                      onUpdate={updateEntry}
                      onRemove={removeEntry}
                      onAddTask={addTask}
                      onRemoveTask={removeTask}
                      onUpdateTask={updateTask}
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* Shitur Section */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 bg-purple-50 border-b-2 border-purple-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm">🚔 שיטור עירוני ({shiturEntries.length})</h3>
              <button onClick={() => addEntry('שיטור')} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold">
                + הוסף עובד
              </button>
            </div>
            
            <div className="divide-y divide-gray-100">
              {shiturEntries.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">אין שיבוצים לשיטור.</div>
              ) : (
                shiturEntries.map((entry, idx) => {
                  const realIdx = entries.indexOf(entry);
                  return (
                    <DailyEntryCard
                      key={entry.id || idx}
                      entry={entry}
                      idx={realIdx}
                      staff={staff}
                      vehicles={vehicles}
                      availableTasks={tasksShitur}
                      onUpdate={updateEntry}
                      onRemove={removeEntry}
                      onAddTask={addTask}
                      onRemoveTask={removeTask}
                      onUpdateTask={updateTask}
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* General Notes */}
          <div className="bg-white rounded-lg shadow p-4">
            <label className="block font-bold text-gray-700 text-sm mb-2">📌 הערות כלליות:</label>
            <textarea
              value={generalNotes}
              onChange={(e) => { setGeneralNotes(e.target.value); setSaved(false); }}
              placeholder="שימו לב, אכיפת הכלבים בימים הקרובים..."
              rows={3}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm resize-none"
            />
            <label className="block font-bold text-gray-700 text-sm mb-2 mt-3">✍️ חתימה:</label>
            <input
              type="text"
              value={signoffMessage}
              onChange={(e) => { setSignoffMessage(e.target.value); setSaved(false); }}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
            />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Daily Entry Card ─────────────────────────────────────────────────
function DailyEntryCard({ entry, idx, staff, vehicles, availableTasks, onUpdate, onRemove, onAddTask, onRemoveTask, onUpdateTask }) {
  const [newTask, setNewTask] = useState('');
  const [expanded, setExpanded] = useState(true);

  const toggleTask = (task) => {
    const currentTasks = entry.tasks || [];
    if (currentTasks.includes(task)) {
      // Remove
      const taskIdx = currentTasks.indexOf(task);
      onRemoveTask(idx, taskIdx);
    } else {
      // Add
      onAddTask(idx, task);
    }
  };

  return (
    <div className="p-3 sm:p-4">
      {/* Header row */}
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Staff selector */}
          <select
            value={entry.staff_id || ''}
            onChange={(e) => onUpdate(idx, 'staff_id', e.target.value || null)}
            className="px-2 py-1.5 border-2 border-gray-200 rounded-lg text-xs sm:text-sm font-semibold focus:border-blue-500 focus:outline-none"
          >
            <option value="">-- בחר עובד --</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>

          {/* Vehicle */}
          <select
            value={entry.vehicle || ''}
            onChange={(e) => onUpdate(idx, 'vehicle', e.target.value)}
            className="px-2 py-1.5 border-2 border-gray-200 rounded-lg text-xs sm:text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">רכב</option>
            {vehicles.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>

          {/* Times */}
          <div className="flex items-center gap-1">
            <input type="time" value={entry.start_time}
              onChange={(e) => onUpdate(idx, 'start_time', e.target.value)}
              className="px-1 py-1.5 border-2 border-gray-200 rounded text-xs w-full focus:border-blue-500 focus:outline-none" />
            <span className="text-xs text-gray-400">-</span>
            <input type="time" value={entry.end_time}
              onChange={(e) => onUpdate(idx, 'end_time', e.target.value)}
              className="px-1 py-1.5 border-2 border-gray-200 rounded text-xs w-full focus:border-blue-500 focus:outline-none" />
          </div>

          {/* Backup toggle + delete */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input type="checkbox" checked={entry.is_backup}
                onChange={(e) => onUpdate(idx, 'is_backup', e.target.checked)}
                className="rounded" />
              <span>חלופי</span>
            </label>
            <button onClick={() => setExpanded(!expanded)} className="text-gray-400 text-xs">
              {expanded ? '▼' : '▶'}
            </button>
            <button onClick={() => onRemove(idx)} className="text-red-400 hover:text-red-600 text-sm font-bold mr-auto">✕</button>
          </div>
        </div>
      </div>

      {/* Tasks - collapsible */}
      {expanded && (
        <div className="mr-2 sm:mr-4 space-y-1.5">
          {/* Special notes */}
          <input
            type="text"
            value={entry.special_notes || ''}
            onChange={(e) => onUpdate(idx, 'special_notes', e.target.value)}
            placeholder="הערה מיוחדת (חפיפה, הצטרפות...)"
            className="w-full px-2 py-1 border border-dashed border-orange-300 rounded text-xs focus:border-orange-500 focus:outline-none bg-orange-50/50"
          />
          
          {/* Checkbox task list - common tasks */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 bg-gray-50 rounded-lg p-2">
            {availableTasks.map((task) => (
              <label key={task} className="flex items-center gap-1.5 text-xs cursor-pointer min-w-fit">
                <input
                  type="checkbox"
                  checked={(entry.tasks || []).includes(task)}
                  onChange={() => toggleTask(task)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={`${(entry.tasks || []).includes(task) ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                  {task}
                </span>
              </label>
            ))}
          </div>

          {/* Custom tasks (not in available list) */}
          {(entry.tasks || []).filter(t => !availableTasks.includes(t)).map((task, tIdx) => {
            const realTaskIdx = (entry.tasks || []).indexOf(task);
            return (
              <div key={tIdx} className="flex items-center gap-1">
                <span className="text-blue-400 text-xs">✦</span>
                <input
                  type="text"
                  value={task}
                  onChange={(e) => onUpdateTask(idx, realTaskIdx, e.target.value)}
                  className="flex-1 px-2 py-1 border border-blue-200 rounded text-xs focus:border-blue-400 focus:outline-none bg-blue-50/30"
                />
                <button onClick={() => onRemoveTask(idx, realTaskIdx)} className="text-red-300 hover:text-red-500 text-xs px-1">✕</button>
              </div>
            );
          })}
          
          {/* Add custom task */}
          <div className="flex items-center gap-1">
            <span className="text-gray-300 text-xs">+</span>
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTask.trim()) {
                  onAddTask(idx, newTask.trim());
                  setNewTask('');
                }
              }}
              placeholder="הוסף משימה מותאמת (Enter)"
              className="flex-1 px-2 py-1 border border-dashed border-gray-200 rounded text-xs focus:border-blue-400 focus:outline-none text-gray-500"
            />
            {newTask.trim() && (
              <button
                onClick={() => { onAddTask(idx, newTask.trim()); setNewTask(''); }}
                className="text-blue-500 text-xs font-bold px-1"
              >✓</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────
function SettingsTab({ departmentId, settings, onSettingsChange }) {
  const [localVehicles, setLocalVehicles] = useState(settings?.vehicles || FALLBACK_VEHICLES);
  const [localTasksPikuach, setLocalTasksPikuach] = useState(settings?.tasks_pikuach || FALLBACK_TASKS_PIKUACH);
  const [localTasksShitur, setLocalTasksShitur] = useState(settings?.tasks_shitur || FALLBACK_TASKS_SHITUR);
  const [newVehicle, setNewVehicle] = useState('');
  const [newTaskPikuach, setNewTaskPikuach] = useState('');
  const [newTaskShitur, setNewTaskShitur] = useState('');
  const [saving, setSaving] = useState(false);

  const saveSetting = async (key, value) => {
    setSaving(true);
    try {
      const res = await fetch('/api/security-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department_id: departmentId, key, value })
      });
      const data = await res.json();
      if (data.success) {
        onSettingsChange({ ...settings, [key]: value });
        toast.success('נשמר ✅');
      } else {
        toast.error(data.error);
      }
    } catch { toast.error('שגיאה בשמירה'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {/* Vehicles */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-sm">🚗 רכבים</h3>
          <button
            onClick={() => saveSetting('vehicles', localVehicles)}
            disabled={saving}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold disabled:opacity-50"
          >
            💾 שמור
          </button>
        </div>
        <div className="p-4 space-y-2">
          {localVehicles.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={v}
                onChange={(e) => {
                  const updated = [...localVehicles];
                  updated[i] = e.target.value;
                  setLocalVehicles(updated);
                }}
                className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={() => setLocalVehicles(localVehicles.filter((_, idx) => idx !== i))}
                className="px-2 py-2 text-red-400 hover:text-red-600 font-bold"
              >✕</button>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={newVehicle}
              onChange={(e) => setNewVehicle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newVehicle.trim()) {
                  setLocalVehicles([...localVehicles, newVehicle.trim()]);
                  setNewVehicle('');
                }
              }}
              placeholder="הוסף רכב חדש..."
              className="flex-1 px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={() => { if (newVehicle.trim()) { setLocalVehicles([...localVehicles, newVehicle.trim()]); setNewVehicle(''); }}}
              className="px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-bold"
            >+</button>
          </div>
        </div>
      </div>

      {/* Tasks Pikuach */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-sm">🔍 משימות ברירת מחדל - פיקוח</h3>
          <button
            onClick={() => saveSetting('tasks_pikuach', localTasksPikuach)}
            disabled={saving}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold disabled:opacity-50"
          >
            💾 שמור
          </button>
        </div>
        <div className="p-4 space-y-2">
          {localTasksPikuach.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={t}
                onChange={(e) => {
                  const updated = [...localTasksPikuach];
                  updated[i] = e.target.value;
                  setLocalTasksPikuach(updated);
                }}
                className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={() => setLocalTasksPikuach(localTasksPikuach.filter((_, idx) => idx !== i))}
                className="px-2 py-2 text-red-400 hover:text-red-600 font-bold"
              >✕</button>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={newTaskPikuach}
              onChange={(e) => setNewTaskPikuach(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTaskPikuach.trim()) {
                  setLocalTasksPikuach([...localTasksPikuach, newTaskPikuach.trim()]);
                  setNewTaskPikuach('');
                }
              }}
              placeholder="הוסף משימה חדשה..."
              className="flex-1 px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={() => { if (newTaskPikuach.trim()) { setLocalTasksPikuach([...localTasksPikuach, newTaskPikuach.trim()]); setNewTaskPikuach(''); }}}
              className="px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-bold"
            >+</button>
          </div>
        </div>
      </div>

      {/* Tasks Shitur */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 bg-purple-50 border-b border-purple-200 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-sm">🚔 משימות ברירת מחדל - שיטור</h3>
          <button
            onClick={() => saveSetting('tasks_shitur', localTasksShitur)}
            disabled={saving}
            className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold disabled:opacity-50"
          >
            💾 שמור
          </button>
        </div>
        <div className="p-4 space-y-2">
          {localTasksShitur.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={t}
                onChange={(e) => {
                  const updated = [...localTasksShitur];
                  updated[i] = e.target.value;
                  setLocalTasksShitur(updated);
                }}
                className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none"
              />
              <button
                onClick={() => setLocalTasksShitur(localTasksShitur.filter((_, idx) => idx !== i))}
                className="px-2 py-2 text-red-400 hover:text-red-600 font-bold"
              >✕</button>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={newTaskShitur}
              onChange={(e) => setNewTaskShitur(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTaskShitur.trim()) {
                  setLocalTasksShitur([...localTasksShitur, newTaskShitur.trim()]);
                  setNewTaskShitur('');
                }
              }}
              placeholder="הוסף משימה חדשה..."
              className="flex-1 px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm focus:border-purple-500 focus:outline-none"
            />
            <button
              onClick={() => { if (newTaskShitur.trim()) { setLocalTasksShitur([...localTasksShitur, newTaskShitur.trim()]); setNewTaskShitur(''); }}}
              className="px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-bold"
            >+</button>
          </div>
        </div>
      </div>
    </div>
  );
}
