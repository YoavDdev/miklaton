'use client';

import { useState, useEffect } from 'react';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAYS_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const SHIFT_PRESETS = [
  { label: '24 שעות', start: 8, end: 8, icon: '🔄' },
  { label: 'בוקר', start: 8, end: 16, icon: '🌅' },
  { label: 'ערב', start: 16, end: 0, icon: '🌆' },
  { label: 'לילה', start: 0, end: 8, icon: '🌙' },
];

function formatHours(start, end) {
  if (start === end) return '24 שעות';
  return `${String(start).padStart(2, '0')}:00-${String(end).padStart(2, '0')}:00`;
}

export default function DutyFormPage({ params }) {
  const { departmentId } = params;
  const [department, setDepartment] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [existingDuties, setExistingDuties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [managerName, setManagerName] = useState('');
  const [showSchedule, setShowSchedule] = useState(true);
  const [showAddContact, setShowAddContact] = useState(false);

  // New contact form
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRole, setNewContactRole] = useState('');

  // Each contact entry: { contactId, enabled, dutyType, selectedDays, presetIndex, customStart, customEnd, isNew, newData }
  const [contactEntries, setContactEntries] = useState([]);

  // New contacts pending submission
  const [pendingNewContacts, setPendingNewContacts] = useState([]);

  useEffect(() => {
    fetchDepartmentData();
  }, [departmentId]);

  const fetchDepartmentData = async () => {
    try {
      const res = await fetch(`/api/duty-form?departmentId=${departmentId}`);
      const data = await res.json();

      if (!data.success) {
        setError('מכלול לא נמצא');
        setLoading(false);
        return;
      }

      const dept = data.data.department;
      setDepartment(dept);
      setContacts(dept.contacts || []);
      setExistingDuties(data.data.existingDuties || []);

      // All contacts start OFF
      const entries = (dept.contacts || []).map(contact => ({
        contactId: contact.id,
        enabled: false,
        dutyType: 'oncall',
        selectedDays: [],
        presetIndex: 0,
        customStart: 8,
        customEnd: 8,
      }));

      setContactEntries(entries);
    } catch (err) {
      setError('שגיאה בטעינת הנתונים');
    }
    setLoading(false);
  };

  const updateEntry = (contactId, updates) => {
    setContactEntries(prev =>
      prev.map(entry =>
        entry.contactId === contactId ? { ...entry, ...updates } : entry
      )
    );
  };

  const toggleDay = (contactId, dayIndex) => {
    setContactEntries(prev =>
      prev.map(entry => {
        if (entry.contactId !== contactId) return entry;
        const days = entry.selectedDays.includes(dayIndex)
          ? entry.selectedDays.filter(d => d !== dayIndex)
          : [...entry.selectedDays, dayIndex];
        return { ...entry, selectedDays: days };
      })
    );
  };

  const selectPreset = (contactId, presetIndex) => {
    const preset = SHIFT_PRESETS[presetIndex];
    updateEntry(contactId, {
      presetIndex,
      customStart: preset.start,
      customEnd: preset.end,
    });
  };

  // Update pending new contact entry
  const updateNewContact = (tempId, updates) => {
    setPendingNewContacts(prev =>
      prev.map(nc => nc.tempId === tempId ? { ...nc, ...updates } : nc)
    );
  };

  const toggleNewContactDay = (tempId, dayIndex) => {
    setPendingNewContacts(prev =>
      prev.map(nc => {
        if (nc.tempId !== tempId) return nc;
        const days = nc.selectedDays.includes(dayIndex)
          ? nc.selectedDays.filter(d => d !== dayIndex)
          : [...nc.selectedDays, dayIndex];
        return { ...nc, selectedDays: days };
      })
    );
  };

  const addNewContact = () => {
    if (!newContactName.trim()) return;
    const tempId = `new_${Date.now()}`;
    setPendingNewContacts(prev => [...prev, {
      tempId,
      full_name: newContactName.trim(),
      phone: newContactPhone.trim(),
      role: newContactRole.trim(),
      dutyType: 'oncall',
      selectedDays: [],
      presetIndex: 0,
      customStart: 8,
      customEnd: 8,
    }]);
    setNewContactName('');
    setNewContactPhone('');
    setNewContactRole('');
    setShowAddContact(false);
  };

  const removeNewContact = (tempId) => {
    setPendingNewContacts(prev => prev.filter(nc => nc.tempId !== tempId));
  };

  // Get existing duties for a specific contact and day
  const getDutiesForContactDay = (contactId, dayIndex) => {
    return existingDuties.filter(
      d => d.contact_id === contactId && d.day_of_week === dayIndex
    );
  };

  const handleSubmit = async () => {
    const activeEntries = contactEntries.filter(e => e.enabled && e.selectedDays.length > 0);
    const activeNewContacts = pendingNewContacts.filter(nc => nc.selectedDays.length > 0);

    if (activeEntries.length === 0 && activeNewContacts.length === 0) {
      setError('יש לסמן לפחות איש קשר אחד עם ימים');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const entries = activeEntries.map(entry => ({
        contact_id: entry.contactId,
        dutyType: entry.dutyType,
        days: entry.selectedDays.map(day => ({
          day_of_week: day,
          start_hour: entry.customStart,
          end_hour: entry.customEnd,
        })),
      }));

      const newContacts = activeNewContacts.map(nc => ({
        full_name: nc.full_name,
        phone: nc.phone,
        role: nc.role,
        dutyType: nc.dutyType,
        days: nc.selectedDays.map(day => ({
          day_of_week: day,
          start_hour: nc.customStart,
          end_hour: nc.customEnd,
        })),
      }));

      const res = await fetch('/api/duty-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId,
          entries: entries.length > 0 ? entries : undefined,
          newContacts: newContacts.length > 0 ? newContacts : undefined,
          submittedBy: managerName || 'מנהל מכלול',
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || 'שגיאה בשמירה');
      }
    } catch (err) {
      setError('שגיאה בשליחת הטופס');
    }
    setSubmitting(false);
  };

  // ====== LOADING STATE ======
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

  // ====== ERROR STATE ======
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

  // ====== SUCCESS STATE ======
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm w-full">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-green-800 mb-2">נשמר בהצלחה!</h1>
          <p className="text-gray-600 mb-6">
            הכוננויות של <strong>{department.name}</strong> עודכנו במערכת
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setPendingNewContacts([]);
              fetchDepartmentData();
            }}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            חזור לטופס
          </button>
        </div>
      </div>
    );
  }

  // ====== Shared contact edit card renderer ======
  const renderEditCard = (entry, contact, { onUpdate, onToggleDay, onSelectPreset, isNew, onRemove }) => {
    return (
      <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
        {/* Duty Type */}
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">סוג:</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onUpdate({ dutyType: 'oncall' })}
              className={`py-2 px-2 rounded-xl text-center transition-all border-2 ${
                entry.dutyType === 'oncall'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              <span className="text-base">📞</span>
              <span className="text-sm font-bold mr-1">כונן</span>
            </button>
            <button
              onClick={() => onUpdate({ dutyType: 'sleep' })}
              className={`py-2 px-2 rounded-xl text-center transition-all border-2 ${
                entry.dutyType === 'sleep'
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              <span className="text-base">🏢</span>
              <span className="text-sm font-bold mr-1">לן בעירייה</span>
            </button>
          </div>
        </div>

        {/* Shift Presets */}
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">משמרת:</label>
          <div className="grid grid-cols-4 gap-1.5">
            {SHIFT_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => onSelectPreset(idx)}
                className={`py-1.5 px-1 rounded-lg text-center transition-all border-2 ${
                  entry.presetIndex === idx
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                <div className="text-sm">{preset.icon}</div>
                <div className="text-[10px] font-bold leading-tight">{preset.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Hours */}
        <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl">
          <div className="flex-1 text-center">
            <label className="block text-[10px] text-gray-500 mb-0.5">מ-</label>
            <select
              value={entry.customStart}
              onChange={(e) => onUpdate({ customStart: parseInt(e.target.value), presetIndex: -1 })}
              className="w-full px-1 py-1.5 border border-gray-200 rounded-lg text-center font-bold text-sm bg-white"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
              ))}
            </select>
          </div>
          <span className="text-xl text-gray-400 pt-3">←</span>
          <div className="flex-1 text-center">
            <label className="block text-[10px] text-gray-500 mb-0.5">עד-</label>
            <select
              value={entry.customEnd}
              onChange={(e) => onUpdate({ customEnd: parseInt(e.target.value), presetIndex: -1 })}
              className="w-full px-1 py-1.5 border border-gray-200 rounded-lg text-center font-bold text-sm bg-white"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
              ))}
            </select>
          </div>
        </div>

        {/* Days */}
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5">ימים:</label>
          <div className="grid grid-cols-7 gap-1">
            {DAYS.map((day, i) => (
              <button
                key={i}
                onClick={() => onToggleDay(i)}
                className={`py-2 rounded-lg text-xs font-bold transition-all ${
                  entry.selectedDays.includes(i)
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {day.slice(0, 2)}׳
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-1.5">
            <button
              onClick={() => onUpdate({ selectedDays: [0,1,2,3,4] })}
              className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold"
            >
              א׳-ה׳
            </button>
            <button
              onClick={() => onUpdate({ selectedDays: [0,1,2,3,4,5,6] })}
              className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold"
            >
              כל השבוע
            </button>
            <button
              onClick={() => onUpdate({ selectedDays: [5,6] })}
              className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold"
            >
              סופ&quot;ש
            </button>
          </div>
        </div>

        {/* Remove new contact button */}
        {isNew && onRemove && (
          <button
            onClick={onRemove}
            className="w-full mt-1 py-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
          >
            הסר איש קשר
          </button>
        )}
      </div>
    );
  };

  // ====== MAIN FORM ======
  const activeCount = contactEntries.filter(e => e.enabled && e.selectedDays.length > 0).length + pendingNewContacts.filter(nc => nc.selectedDays.length > 0).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white pb-24" dir="rtl">
      {/* Header */}
      <div className="bg-purple-600 text-white px-4 py-4 shadow-lg">
        <div className="max-w-lg mx-auto">
          <p className="text-purple-200 text-xs">מקלטון - עיריית יהוד מונוסון</p>
          <h1 className="text-lg font-bold mt-0.5">{department.name}</h1>
          <p className="text-purple-200 text-xs mt-0.5">עדכון כוננויות שבועי</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">

        {/* ═══════ SECTION 1: Current Schedule Overview ═══════ */}
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
                  <p className="text-xs text-gray-400 mt-1">הוסף כוננויות חדשות למטה</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-blue-50">
                        <th className="p-2 text-right border-b border-blue-100 font-bold text-gray-700 sticky right-0 bg-blue-50 min-w-[80px]">שם</th>
                        {DAYS_SHORT.map((d, i) => (
                          <th key={i} className="p-1.5 text-center border-b border-blue-100 font-bold text-gray-600 min-w-[36px]">{d}</th>
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
                              const duties = getDutiesForContactDay(contact.id, dayIdx);
                              if (duties.length === 0) {
                                return <td key={dayIdx} className="p-1 text-center text-gray-200">-</td>;
                              }
                              const duty = duties[0];
                              const isSleep = duty.notes?.includes('[לן]');
                              return (
                                <td key={dayIdx} className="p-0.5 text-center">
                                  <div className={`text-[9px] font-bold px-0.5 py-1 rounded ${
                                    isSleep
                                      ? 'bg-orange-100 text-orange-700'
                                      : 'bg-green-100 text-green-700'
                                  }`}>
                                    {isSleep ? '🏢' : '📞'}
                                    <br />
                                    {duty.start_hour === duty.end_hour
                                      ? '24h'
                                      : `${duty.start_hour}-${duty.end_hour}`
                                    }
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
                  📞 כונן &nbsp;|&nbsp; 🏢 לן בעירייה &nbsp;|&nbsp; הפעל איש קשר למטה כדי לעדכן את המשמרות שלו
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
            עדכון אנשי קשר קיימים
            <span className="text-xs text-gray-500 font-normal">(הפעל כדי לעדכן)</span>
          </h2>

          <div className="space-y-3">
            {contacts.map(contact => {
              const entry = contactEntries.find(e => e.contactId === contact.id);
              if (!entry) return null;

              // Existing duties for this contact (for badge)
              const contactDuties = existingDuties.filter(d => d.contact_id === contact.id);
              const hasDuties = contactDuties.length > 0;

              return (
                <div
                  key={contact.id}
                  className={`bg-white rounded-2xl shadow-sm border-2 transition-all ${
                    entry.enabled
                      ? 'border-purple-400 shadow-md'
                      : 'border-gray-200'
                  }`}
                >
                  {/* Contact Header */}
                  <button
                    onClick={() => updateEntry(contact.id, { enabled: !entry.enabled })}
                    className="w-full flex items-center justify-between p-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base font-bold ${
                        entry.enabled
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}>
                        {contact.full_name.charAt(0)}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 text-sm">{contact.full_name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {contact.role && (
                            <span className="text-[10px] text-gray-500">{contact.role}</span>
                          )}
                          {hasDuties && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">
                              {contactDuties.length} משמרות
                            </span>
                          )}
                          {!hasDuties && (
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                              ללא משמרות
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={`w-11 h-6 rounded-full transition-colors relative ${
                      entry.enabled ? 'bg-purple-600' : 'bg-gray-300'
                    }`}>
                      <div className={`w-4.5 h-4.5 bg-white rounded-full absolute top-[3px] transition-all shadow ${
                        entry.enabled ? 'right-[3px]' : 'left-[3px]'
                      }`} style={{ width: '18px', height: '18px' }}></div>
                    </div>
                  </button>

                  {/* Warning for existing duties */}
                  {entry.enabled && hasDuties && (
                    <div className="mx-4 mb-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-[10px] text-yellow-800 font-semibold">
                        ⚠️ יש {contactDuties.length} משמרות קיימות — שמירה תחליף אותן
                      </p>
                    </div>
                  )}

                  {/* Edit form */}
                  {entry.enabled && renderEditCard(
                    entry,
                    contact,
                    {
                      onUpdate: (updates) => updateEntry(contact.id, updates),
                      onToggleDay: (dayIdx) => toggleDay(contact.id, dayIdx),
                      onSelectPreset: (idx) => selectPreset(contact.id, idx),
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

          {/* Pending new contacts */}
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
              {renderEditCard(
                nc,
                { full_name: nc.full_name },
                {
                  onUpdate: (updates) => updateNewContact(nc.tempId, updates),
                  onToggleDay: (dayIdx) => toggleNewContactDay(nc.tempId, dayIdx),
                  onSelectPreset: (idx) => {
                    const preset = SHIFT_PRESETS[idx];
                    updateNewContact(nc.tempId, { presetIndex: idx, customStart: preset.start, customEnd: preset.end });
                  },
                  isNew: true,
                  onRemove: () => removeNewContact(nc.tempId),
                }
              )}
            </div>
          ))}

          {/* Add new contact form */}
          {showAddContact ? (
            <div className="bg-white rounded-2xl shadow-sm border-2 border-dashed border-green-300 p-4">
              <div className="space-y-3">
                <input
                  type="text"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="שם מלא *"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-green-500 focus:outline-none"
                />
                <input
                  type="tel"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  placeholder="טלפון"
                  dir="ltr"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-green-500 focus:outline-none text-right"
                />
                <input
                  type="text"
                  value={newContactRole}
                  onChange={(e) => setNewContactRole(e.target.value)}
                  placeholder="תפקיד (אופציונלי)"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-green-500 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={addNewContact}
                    disabled={!newContactName.trim()}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold py-2 rounded-xl text-sm transition-colors"
                  >
                    הוסף
                  </button>
                  <button
                    onClick={() => { setShowAddContact(false); setNewContactName(''); setNewContactPhone(''); setNewContactRole(''); }}
                    className="px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 rounded-xl text-sm transition-colors"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddContact(true)}
              className="w-full py-3 border-2 border-dashed border-green-300 rounded-2xl text-green-700 font-bold text-sm hover:bg-green-50 transition-colors"
            >
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

        {/* Summary */}
        {activeCount > 0 && (
          <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-xl text-center">
            <p className="text-sm text-purple-700 font-semibold">
              {contactEntries.filter(e => e.enabled && e.selectedDays.length > 0 && e.dutyType === 'oncall').length +
               pendingNewContacts.filter(nc => nc.selectedDays.length > 0 && nc.dutyType === 'oncall').length} כוננים |{' '}
              {contactEntries.filter(e => e.enabled && e.selectedDays.length > 0 && e.dutyType === 'sleep').length +
               pendingNewContacts.filter(nc => nc.selectedDays.length > 0 && nc.dutyType === 'sleep').length} לנים |{' '}
              {contactEntries
                .filter(e => e.enabled)
                .reduce((sum, e) => sum + e.selectedDays.length, 0) +
               pendingNewContacts
                .reduce((sum, nc) => sum + nc.selectedDays.length, 0)
              } משמרות סה&quot;כ
            </p>
          </div>
        )}
      </div>

      {/* Sticky Submit */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 shadow-lg px-4 py-3" dir="rtl">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSubmit}
            disabled={submitting || activeCount === 0}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-bold py-3.5 px-6 rounded-2xl text-base shadow-md transition-all active:scale-[0.98]"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                שומר...
              </span>
            ) : activeCount === 0 ? (
              'הפעל אנשי קשר כדי לשמור'
            ) : (
              `שמור ${activeCount} עדכונים`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
