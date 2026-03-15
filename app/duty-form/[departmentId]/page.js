'use client';

import { useState, useEffect } from 'react';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAYS_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const SHIFT_PRESETS = [
  { label: '24h', start: 8, end: 8, icon: '🔄', desc: '24 שעות' },
  { label: 'בוקר', start: 8, end: 16, icon: '🌅', desc: '08-16' },
  { label: 'ערב', start: 16, end: 0, icon: '🌆', desc: '16-00' },
  { label: 'לילה', start: 0, end: 8, icon: '🌙', desc: '00-08' },
];

function makeDaysMap() {
  const days = {};
  for (let i = 0; i < 7; i++) days[i] = { active: false, start: 8, end: 8 };
  return days;
}

export default function DutyFormPage({ params }) {
  const { departmentId } = params;
  const [department, setDepartment] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [existingDuties, setExistingDuties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [managerName, setManagerName] = useState('');
  const [showSchedule, setShowSchedule] = useState(true);
  const [showAddContact, setShowAddContact] = useState(false);
  const [deletingDuty, setDeletingDuty] = useState(null);

  // New contact form
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRole, setNewContactRole] = useState('');

  // Per-contact: { contactId, enabled, dutyType, days: {0..6: {active, start, end}}, saving, saved }
  const [contactEntries, setContactEntries] = useState([]);

  // New contacts pending
  const [pendingNewContacts, setPendingNewContacts] = useState([]);

  useEffect(() => {
    fetchDepartmentData();
  }, [departmentId]);

  const fetchDepartmentData = async () => {
    try {
      const res = await fetch(`/api/duty-form?departmentId=${departmentId}`);
      const data = await res.json();
      if (!data.success) { setError('מכלול לא נמצא'); setLoading(false); return; }

      const dept = data.data.department;
      setDepartment(dept);
      setContacts(dept.contacts || []);
      setExistingDuties(data.data.existingDuties || []);

      const duties = data.data.existingDuties || [];
      const entries = (dept.contacts || []).map(contact => {
        const contactDuties = duties.filter(d => d.contact_id === contact.id);
        const days = makeDaysMap();
        let dutyType = 'oncall';

        // Pre-fill from existing duties
        for (const duty of contactDuties) {
          days[duty.day_of_week] = {
            active: true,
            start: duty.start_hour,
            end: duty.end_hour,
          };
          if (duty.notes?.includes('[לן]')) dutyType = 'sleep';
        }

        return {
          contactId: contact.id,
          enabled: false,
          dutyType,
          days,
          saving: false,
          saved: false,
        };
      });
      setContactEntries(entries);
    } catch (err) {
      setError('שגיאה בטעינת הנתונים');
    }
    setLoading(false);
  };

  // ── Delete a single existing duty ──
  const handleDeleteDuty = async (dutyId) => {
    setDeletingDuty(dutyId);
    try {
      const res = await fetch(`/api/duty-roster?id=${dutyId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setExistingDuties(prev => prev.filter(d => d.id !== dutyId));
      }
    } catch (err) {
      // silent fail
    }
    setDeletingDuty(null);
  };

  // ── Entry updaters ──
  const updateEntry = (contactId, updates) => {
    setContactEntries(prev =>
      prev.map(e => e.contactId === contactId ? { ...e, ...updates, saved: false } : e)
    );
  };

  const updateEntryDay = (contactId, dayIdx, dayUpdates) => {
    setContactEntries(prev =>
      prev.map(e => {
        if (e.contactId !== contactId) return e;
        return {
          ...e,
          saved: false,
          days: { ...e.days, [dayIdx]: { ...e.days[dayIdx], ...dayUpdates } }
        };
      })
    );
  };

  const toggleEntryDay = (contactId, dayIdx) => {
    setContactEntries(prev =>
      prev.map(e => {
        if (e.contactId !== contactId) return e;
        return {
          ...e,
          saved: false,
          days: { ...e.days, [dayIdx]: { ...e.days[dayIdx], active: !e.days[dayIdx].active } }
        };
      })
    );
  };

  const applyPresetToAll = (contactId, presetIdx) => {
    const preset = SHIFT_PRESETS[presetIdx];
    setContactEntries(prev =>
      prev.map(e => {
        if (e.contactId !== contactId) return e;
        const newDays = { ...e.days };
        for (let i = 0; i < 7; i++) {
          if (newDays[i].active) {
            newDays[i] = { ...newDays[i], start: preset.start, end: preset.end };
          }
        }
        return { ...e, days: newDays, saved: false };
      })
    );
  };

  const setDaysQuick = (contactId, dayIndexes) => {
    setContactEntries(prev =>
      prev.map(e => {
        if (e.contactId !== contactId) return e;
        const newDays = { ...e.days };
        for (let i = 0; i < 7; i++) {
          newDays[i] = { ...newDays[i], active: dayIndexes.includes(i) };
        }
        return { ...e, days: newDays, saved: false };
      })
    );
  };

  // ── Save single existing contact ──
  const handleSaveContact = async (contactId) => {
    const entry = contactEntries.find(e => e.contactId === contactId);
    if (!entry) return;

    const activeDays = Object.entries(entry.days)
      .filter(([, d]) => d.active)
      .map(([dayIdx, d]) => ({
        day_of_week: parseInt(dayIdx),
        start_hour: d.start,
        end_hour: d.end,
      }));

    if (activeDays.length === 0) {
      setError('יש לבחור לפחות יום אחד');
      return;
    }

    updateEntry(contactId, { saving: true });
    setError('');

    try {
      const res = await fetch('/api/duty-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId,
          entries: [{
            contact_id: contactId,
            dutyType: entry.dutyType,
            days: activeDays,
          }],
          submittedBy: managerName || 'מנהל מכלול',
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh duties from server
        const refreshRes = await fetch(`/api/duty-form?departmentId=${departmentId}`);
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          setExistingDuties(refreshData.data.existingDuties || []);
        }
        setContactEntries(prev =>
          prev.map(e => e.contactId === contactId ? { ...e, saving: false, saved: true } : e)
        );
      } else {
        setError(data.error || 'שגיאה בשמירה');
        updateEntry(contactId, { saving: false });
      }
    } catch (err) {
      setError('שגיאה בשליחת הטופס');
      updateEntry(contactId, { saving: false });
    }
  };

  // ── New contact helpers ──
  const updateNewContact = (tempId, updates) => {
    setPendingNewContacts(prev =>
      prev.map(nc => nc.tempId === tempId ? { ...nc, ...updates, saved: false } : nc)
    );
  };

  const updateNewContactDay = (tempId, dayIdx, dayUpdates) => {
    setPendingNewContacts(prev =>
      prev.map(nc => {
        if (nc.tempId !== tempId) return nc;
        return { ...nc, saved: false, days: { ...nc.days, [dayIdx]: { ...nc.days[dayIdx], ...dayUpdates } } };
      })
    );
  };

  const toggleNewContactDay = (tempId, dayIdx) => {
    setPendingNewContacts(prev =>
      prev.map(nc => {
        if (nc.tempId !== tempId) return nc;
        return { ...nc, saved: false, days: { ...nc.days, [dayIdx]: { ...nc.days[dayIdx], active: !nc.days[dayIdx].active } } };
      })
    );
  };

  const applyPresetToAllNew = (tempId, presetIdx) => {
    const preset = SHIFT_PRESETS[presetIdx];
    setPendingNewContacts(prev =>
      prev.map(nc => {
        if (nc.tempId !== tempId) return nc;
        const newDays = { ...nc.days };
        for (let i = 0; i < 7; i++) {
          if (newDays[i].active) newDays[i] = { ...newDays[i], start: preset.start, end: preset.end };
        }
        return { ...nc, days: newDays, saved: false };
      })
    );
  };

  const setDaysQuickNew = (tempId, dayIndexes) => {
    setPendingNewContacts(prev =>
      prev.map(nc => {
        if (nc.tempId !== tempId) return nc;
        const newDays = { ...nc.days };
        for (let i = 0; i < 7; i++) newDays[i] = { ...newDays[i], active: dayIndexes.includes(i) };
        return { ...nc, days: newDays, saved: false };
      })
    );
  };

  const addNewContact = () => {
    if (!newContactName.trim()) return;
    setPendingNewContacts(prev => [...prev, {
      tempId: `new_${Date.now()}`,
      full_name: newContactName.trim(),
      phone: newContactPhone.trim(),
      role: newContactRole.trim(),
      dutyType: 'oncall',
      days: makeDaysMap(),
      saving: false,
      saved: false,
    }]);
    setNewContactName('');
    setNewContactPhone('');
    setNewContactRole('');
    setShowAddContact(false);
  };

  const handleSaveNewContact = async (tempId) => {
    const nc = pendingNewContacts.find(n => n.tempId === tempId);
    if (!nc) return;

    const activeDays = Object.entries(nc.days)
      .filter(([, d]) => d.active)
      .map(([dayIdx, d]) => ({
        day_of_week: parseInt(dayIdx),
        start_hour: d.start,
        end_hour: d.end,
      }));

    if (activeDays.length === 0) {
      setError('יש לבחור לפחות יום אחד');
      return;
    }

    updateNewContact(tempId, { saving: true });
    setError('');

    try {
      const res = await fetch('/api/duty-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId,
          newContacts: [{
            full_name: nc.full_name,
            phone: nc.phone,
            role: nc.role,
            dutyType: nc.dutyType,
            days: activeDays,
          }],
          submittedBy: managerName || 'מנהל מכלול',
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh everything
        const refreshRes = await fetch(`/api/duty-form?departmentId=${departmentId}`);
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          const dept = refreshData.data.department;
          setContacts(dept.contacts || []);
          setExistingDuties(refreshData.data.existingDuties || []);
          // Add any new contacts to entries
          const existingIds = contactEntries.map(e => e.contactId);
          const newEntries = (dept.contacts || [])
            .filter(c => !existingIds.includes(c.id))
            .map(c => ({ contactId: c.id, enabled: false, dutyType: 'oncall', days: makeDaysMap(), saving: false, saved: false }));
          if (newEntries.length > 0) {
            setContactEntries(prev => [...prev, ...newEntries]);
          }
        }
        setPendingNewContacts(prev => prev.filter(n => n.tempId !== tempId));
      } else {
        setError(data.error || 'שגיאה בשמירה');
        updateNewContact(tempId, { saving: false });
      }
    } catch (err) {
      setError('שגיאה בשליחת הטופס');
      updateNewContact(tempId, { saving: false });
    }
  };

  // ── Render per-day editor ──
  const renderDayEditor = (entry, { onToggleDay, onUpdateDay, onApplyPreset, onSetDaysQuick }) => {
    const activeDayCount = Object.values(entry.days).filter(d => d.active).length;
    return (
      <div className="space-y-2">
        {/* Quick select */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-gray-500 font-semibold">בחירה מהירה:</span>
          <button onClick={() => onSetDaysQuick([0,1,2,3,4])} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">א׳-ה׳</button>
          <button onClick={() => onSetDaysQuick([0,1,2,3,4,5,6])} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">כל השבוע</button>
          <button onClick={() => onSetDaysQuick([5,6])} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">סופ&quot;ש</button>
          <button onClick={() => onSetDaysQuick([])} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">נקה</button>
        </div>

        {/* Apply preset to active days */}
        {activeDayCount > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-gray-500 font-semibold">החל שעות לכל הימים:</span>
            {SHIFT_PRESETS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => onApplyPreset(idx)}
                className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold"
              >
                {p.icon} {p.desc}
              </button>
            ))}
          </div>
        )}

        {/* Day rows */}
        <div className="space-y-1">
          {DAYS.map((dayName, i) => {
            const day = entry.days[i];
            return (
              <div key={i} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-all ${
                day.active ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50 border border-transparent'
              }`}>
                {/* Toggle */}
                <button
                  onClick={() => onToggleDay(i)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                    day.active
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {DAYS_SHORT[i]}
                </button>
                <span className={`text-xs font-semibold min-w-[40px] ${day.active ? 'text-gray-800' : 'text-gray-400'}`}>
                  {dayName}
                </span>
                {day.active ? (
                  <div className="flex items-center gap-1 flex-1">
                    <select
                      value={day.start}
                      onChange={(e) => onUpdateDay(i, { start: parseInt(e.target.value) })}
                      className="w-[70px] text-xs py-1 px-1 border border-gray-200 rounded bg-white font-bold text-center"
                    >
                      {Array.from({ length: 24 }, (_, h) => (
                        <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                      ))}
                    </select>
                    <span className="text-gray-400 text-xs">→</span>
                    <select
                      value={day.end}
                      onChange={(e) => onUpdateDay(i, { end: parseInt(e.target.value) })}
                      className="w-[70px] text-xs py-1 px-1 border border-gray-200 rounded bg-white font-bold text-center"
                    >
                      {Array.from({ length: 24 }, (_, h) => (
                        <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                      ))}
                    </select>
                    {day.start === day.end && (
                      <span className="text-[9px] text-purple-600 font-bold">24h</span>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] text-gray-400 flex-1">לא פעיל</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Render full contact edit card ──
  const renderContactCard = (entry, { onUpdate, onToggleDay, onUpdateDay, onApplyPreset, onSetDaysQuick, onSave, isNew, onRemove }) => {
    const activeDayCount = Object.values(entry.days).filter(d => d.active).length;
    return (
      <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
        {/* Duty Type */}
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">סוג:</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onUpdate({ dutyType: 'oncall' })}
              className={`py-2 px-2 rounded-xl text-center transition-all border-2 ${
                entry.dutyType === 'oncall' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              <span className="text-base">📞</span>
              <span className="text-sm font-bold mr-1">כונן</span>
            </button>
            <button
              onClick={() => onUpdate({ dutyType: 'sleep' })}
              className={`py-2 px-2 rounded-xl text-center transition-all border-2 ${
                entry.dutyType === 'sleep' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              <span className="text-base">🏢</span>
              <span className="text-sm font-bold mr-1">לן בעירייה</span>
            </button>
          </div>
        </div>

        {/* Per-day editor */}
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">ימים ושעות:</label>
          {renderDayEditor(entry, { onToggleDay, onUpdateDay, onApplyPreset, onSetDaysQuick })}
        </div>

        {/* Save button */}
        <button
          onClick={onSave}
          disabled={entry.saving || activeDayCount === 0}
          className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
            entry.saved
              ? 'bg-green-100 text-green-700 border-2 border-green-300'
              : entry.saving
                ? 'bg-gray-200 text-gray-500'
                : activeDayCount === 0
                  ? 'bg-gray-100 text-gray-400'
                  : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm active:scale-[0.98]'
          }`}
        >
          {entry.saved ? '✅ נשמר בהצלחה' : entry.saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 inline-block"></span>
              שומר...
            </span>
          ) : activeDayCount === 0 ? 'בחר ימים כדי לשמור' : `שמור ${activeDayCount} ימים`}
        </button>

        {/* Remove new contact */}
        {isNew && onRemove && (
          <button
            onClick={onRemove}
            className="w-full py-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
          >
            הסר איש קשר
          </button>
        )}
      </div>
    );
  };

  // ====== LOADING / ERROR ======
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">טוען...</p>
        </div>
      </div>
    );
  }

  if (error && !department) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm w-full">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">שגיאה</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // ====== MAIN FORM ======
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white pb-8" dir="rtl">
      {/* Header */}
      <div className="bg-purple-600 text-white px-4 py-4 shadow-lg">
        <div className="max-w-lg mx-auto">
          <p className="text-purple-200 text-xs">מקלטון - עיריית יהוד מונוסון</p>
          <h1 className="text-lg font-bold mt-0.5">{department.name}</h1>
          <p className="text-purple-200 text-xs mt-0.5">עדכון כוננויות שבועי</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">

        {/* ═══════ SECTION 1: Current Schedule (with delete) ═══════ */}
        <div className="mb-5">
          <button
            onClick={() => setShowSchedule(!showSchedule)}
            className="w-full flex items-center justify-between bg-white border-2 border-blue-200 rounded-xl px-4 py-3 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">📋</span>
              <span className="font-bold text-gray-900 text-sm">לוח שבועי נוכחי</span>
              {existingDuties.length > 0 && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
                  {existingDuties.length} משמרות
                </span>
              )}
            </div>
            <span className="text-gray-400 text-lg">{showSchedule ? '▲' : '▼'}</span>
          </button>

          {showSchedule && (
            <div className="mt-2 bg-white border-2 border-blue-100 rounded-xl overflow-hidden shadow-sm">
              {existingDuties.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <p className="text-2xl mb-2">📭</p>
                  <p className="text-sm font-semibold">אין כוננויות מוגדרות</p>
                  <p className="text-xs mt-1">הוסף כוננויות חדשות למטה</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-blue-50">
                        <th className="p-2 text-right border-b border-blue-100 font-bold text-gray-700 sticky right-0 bg-blue-50 min-w-[80px]">שם</th>
                        {DAYS_SHORT.map((d, i) => (
                          <th key={i} className="p-1.5 text-center border-b border-blue-100 font-bold text-gray-600 min-w-[44px]">{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map(contact => {
                        const contactDuties = existingDuties.filter(d => d.contact_id === contact.id);
                        if (contactDuties.length === 0) return null;
                        return (
                          <tr key={contact.id} className="border-b border-gray-100 last:border-0">
                            <td className="p-1.5 font-semibold text-gray-800 sticky right-0 bg-white text-[11px]">
                              {contact.full_name}
                            </td>
                            {DAYS_SHORT.map((_, dayIdx) => {
                              const duties = existingDuties.filter(d => d.contact_id === contact.id && d.day_of_week === dayIdx);
                              if (duties.length === 0) {
                                return <td key={dayIdx} className="p-1 text-center text-gray-200">-</td>;
                              }
                              const duty = duties[0];
                              const isSleep = duty.notes?.includes('[לן]');
                              const isDeleting = deletingDuty === duty.id;
                              return (
                                <td key={dayIdx} className="p-0.5 text-center">
                                  <div className={`relative text-[9px] font-bold px-0.5 py-1 rounded group ${
                                    isSleep ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                                  } ${isDeleting ? 'opacity-50' : ''}`}>
                                    {isSleep ? '🏢' : '📞'}<br />
                                    {duty.start_hour === duty.end_hour ? '24h' : `${duty.start_hour}-${duty.end_hour}`}
                                    <button
                                      onClick={() => handleDeleteDuty(duty.id)}
                                      disabled={isDeleting}
                                      className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 text-white rounded-full text-[8px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity shadow"
                                      style={{ touchAction: 'manipulation' }}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="px-3 py-2 bg-blue-50 border-t border-blue-100">
                <p className="text-[10px] text-blue-600 font-semibold text-center">
                  לחץ על ✕ כדי למחוק משמרת &nbsp;|&nbsp; 📞 כונן &nbsp;|&nbsp; 🏢 לן
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ═══════ SECTION 2: Manager Name ═══════ */}
        <div className="mb-5">
          <label className="block text-sm font-bold text-gray-700 mb-1.5">שם המעדכן</label>
          <input
            type="text"
            value={managerName}
            onChange={(e) => setManagerName(e.target.value)}
            placeholder="הכנס את שמך"
            className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-base focus:border-purple-500 focus:outline-none"
          />
        </div>

        {/* ═══════ SECTION 3: Existing contacts ═══════ */}
        <div className="mb-4">
          <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span>👥</span>
            עדכון אנשי קשר
            <span className="text-xs text-gray-500 font-normal">(הפעל → ערוך → שמור)</span>
          </h2>

          <div className="space-y-3">
            {contacts.map(contact => {
              const entry = contactEntries.find(e => e.contactId === contact.id);
              if (!entry) return null;

              const contactDuties = existingDuties.filter(d => d.contact_id === contact.id);
              const hasDuties = contactDuties.length > 0;

              return (
                <div
                  key={contact.id}
                  className={`bg-white rounded-2xl shadow-sm border-2 transition-all ${
                    entry.saved ? 'border-green-400' :
                    entry.enabled ? 'border-purple-400 shadow-md' : 'border-gray-200'
                  }`}
                >
                  {/* Header */}
                  <button
                    onClick={() => updateEntry(contact.id, { enabled: !entry.enabled })}
                    className="w-full flex items-center justify-between p-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base font-bold ${
                        entry.saved ? 'bg-green-600 text-white' :
                        entry.enabled ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {entry.saved ? '✓' : contact.full_name.charAt(0)}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 text-sm">{contact.full_name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {contact.role && <span className="text-[10px] text-gray-500">{contact.role}</span>}
                          {hasDuties && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">
                              {contactDuties.length} משמרות
                            </span>
                          )}
                          {!hasDuties && (
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">ללא</span>
                          )}
                          {entry.saved && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">נשמר ✅</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={`w-11 h-6 rounded-full transition-colors relative ${
                      entry.enabled ? 'bg-purple-600' : 'bg-gray-300'
                    }`}>
                      <div className="bg-white rounded-full absolute top-[3px] transition-all shadow"
                        style={{ width: '18px', height: '18px', [entry.enabled ? 'right' : 'left']: '3px' }}></div>
                    </div>
                  </button>

                  {/* Warning */}
                  {entry.enabled && hasDuties && !entry.saved && (
                    <div className="mx-4 mb-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-[10px] text-yellow-800 font-semibold">
                        ⚠️ שמירה תחליף {contactDuties.length} משמרות קיימות
                      </p>
                    </div>
                  )}

                  {/* Edit form */}
                  {entry.enabled && renderContactCard(
                    entry,
                    {
                      onUpdate: (updates) => updateEntry(contact.id, updates),
                      onToggleDay: (dayIdx) => toggleEntryDay(contact.id, dayIdx),
                      onUpdateDay: (dayIdx, upd) => updateEntryDay(contact.id, dayIdx, upd),
                      onApplyPreset: (idx) => applyPresetToAll(contact.id, idx),
                      onSetDaysQuick: (days) => setDaysQuick(contact.id, days),
                      onSave: () => handleSaveContact(contact.id),
                      isNew: false,
                    }
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══════ SECTION 4: New Contacts ═══════ */}
        <div className="mb-4">
          <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span>➕</span>
            הוספת איש קשר חדש
          </h2>

          {pendingNewContacts.map(nc => (
            <div key={nc.tempId} className="bg-white rounded-2xl shadow-sm border-2 border-green-400 mb-3">
              <div className="p-3 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-base font-bold bg-green-600 text-white">
                  {nc.full_name.charAt(0)}
                </div>
                <div className="text-right flex-1">
                  <p className="font-bold text-gray-900 text-sm">{nc.full_name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {nc.phone && <span className="text-[10px] text-gray-500" dir="ltr">{nc.phone}</span>}
                    <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">חדש</span>
                  </div>
                </div>
              </div>
              {renderContactCard(
                nc,
                {
                  onUpdate: (updates) => updateNewContact(nc.tempId, updates),
                  onToggleDay: (dayIdx) => toggleNewContactDay(nc.tempId, dayIdx),
                  onUpdateDay: (dayIdx, upd) => updateNewContactDay(nc.tempId, dayIdx, upd),
                  onApplyPreset: (idx) => applyPresetToAllNew(nc.tempId, idx),
                  onSetDaysQuick: (days) => setDaysQuickNew(nc.tempId, days),
                  onSave: () => handleSaveNewContact(nc.tempId),
                  isNew: true,
                  onRemove: () => setPendingNewContacts(prev => prev.filter(n => n.tempId !== nc.tempId)),
                }
              )}
            </div>
          ))}

          {showAddContact ? (
            <div className="bg-white rounded-2xl shadow-sm border-2 border-dashed border-green-300 p-4">
              <div className="space-y-3">
                <input type="text" value={newContactName} onChange={(e) => setNewContactName(e.target.value)} placeholder="שם מלא *"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-green-500 focus:outline-none" />
                <input type="tel" value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)} placeholder="טלפון" dir="ltr"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-green-500 focus:outline-none text-right" />
                <input type="text" value={newContactRole} onChange={(e) => setNewContactRole(e.target.value)} placeholder="תפקיד (אופציונלי)"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-green-500 focus:outline-none" />
                <div className="flex gap-2">
                  <button onClick={addNewContact} disabled={!newContactName.trim()}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold py-2 rounded-xl text-sm transition-colors">
                    הוסף
                  </button>
                  <button onClick={() => { setShowAddContact(false); setNewContactName(''); setNewContactPhone(''); setNewContactRole(''); }}
                    className="px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 rounded-xl text-sm transition-colors">
                    ביטול
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddContact(true)}
              className="w-full py-3 border-2 border-dashed border-green-300 rounded-2xl text-green-700 font-bold text-sm hover:bg-green-50 transition-colors">
              + הוסף איש קשר חדש למכלול
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border-2 border-red-200 rounded-xl text-center">
            <p className="text-red-700 font-semibold text-sm">{error}</p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-4 mb-4">
          מקלטון - מערכת ניהול כוננויות
        </p>
      </div>
    </div>
  );
}
