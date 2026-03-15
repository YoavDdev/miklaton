'use client';

import { useState, useEffect, use } from 'react';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const SHIFT_PRESETS = [
  { label: '24 שעות', start: 8, end: 8, icon: '🔄' },
  { label: 'בוקר', start: 8, end: 16, icon: '🌅' },
  { label: 'ערב', start: 16, end: 0, icon: '🌆' },
  { label: 'לילה', start: 0, end: 8, icon: '🌙' },
];

export default function DutyFormPage({ params }) {
  const { departmentId } = use(params);
  const [department, setDepartment] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [existingDuties, setExistingDuties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [managerName, setManagerName] = useState('');

  // Each contact gets: { contactId, enabled, dutyType: 'oncall'|'sleep', selectedDays: [0..6], presetIndex, customStart, customEnd }
  const [contactEntries, setContactEntries] = useState([]);

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

      // Initialize entries from existing duties or defaults
      const entries = (dept.contacts || []).map(contact => {
        const duties = (data.data.existingDuties || []).filter(
          d => d.contact_id === contact.id
        );

        if (duties.length > 0) {
          // Pre-fill from existing duties
          const days = duties.map(d => d.day_of_week);
          const firstDuty = duties[0];
          
          // Detect duty type from notes
          const isSleep = firstDuty.notes?.includes('[לן]');

          // Detect preset
          let presetIndex = -1;
          SHIFT_PRESETS.forEach((preset, idx) => {
            if (preset.start === firstDuty.start_hour && preset.end === firstDuty.end_hour) {
              presetIndex = idx;
            }
          });

          return {
            contactId: contact.id,
            enabled: true,
            dutyType: isSleep ? 'sleep' : 'oncall',
            selectedDays: [...new Set(days)],
            presetIndex: presetIndex >= 0 ? presetIndex : -1,
            customStart: firstDuty.start_hour,
            customEnd: firstDuty.end_hour,
          };
        }

        return {
          contactId: contact.id,
          enabled: false,
          dutyType: 'oncall',
          selectedDays: [0, 1, 2, 3, 4], // Default Sun-Thu
          presetIndex: 0, // Default 24h
          customStart: 8,
          customEnd: 8,
        };
      });

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

  const handleSubmit = async () => {
    const activeEntries = contactEntries.filter(e => e.enabled);

    if (activeEntries.length === 0) {
      setError('יש לסמן לפחות כונן אחד');
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

      const res = await fetch('/api/duty-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId,
          entries,
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
              fetchDepartmentData();
            }}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            עדכן שוב
          </button>
        </div>
      </div>
    );
  }

  // ====== MAIN FORM ======
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white" dir="rtl">
      {/* Header */}
      <div className="bg-purple-600 text-white px-4 py-5 shadow-lg">
        <div className="max-w-lg mx-auto">
          <p className="text-purple-200 text-sm mb-1">מקלטון - עיריית יהוד מונוסון</p>
          <h1 className="text-xl font-bold">{department.name}</h1>
          <p className="text-purple-200 text-sm mt-1">עדכון כוננויות שבועי</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Manager Name */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">שם המעדכן</label>
          <input
            type="text"
            value={managerName}
            onChange={(e) => setManagerName(e.target.value)}
            placeholder="הכנס את שמך"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg focus:border-purple-500 focus:outline-none"
          />
        </div>

        {/* Contact Cards */}
        <div className="space-y-4">
          {contacts.map(contact => {
            const entry = contactEntries.find(e => e.contactId === contact.id);
            if (!entry) return null;

            return (
              <div
                key={contact.id}
                className={`bg-white rounded-2xl shadow-sm border-2 transition-all ${
                  entry.enabled
                    ? 'border-purple-400 shadow-md'
                    : 'border-gray-200 opacity-75'
                }`}
              >
                {/* Contact Header - Toggle */}
                <button
                  onClick={() => updateEntry(contact.id, { enabled: !entry.enabled })}
                  className="w-full flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                      entry.enabled
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                      {contact.full_name.charAt(0)}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{contact.full_name}</p>
                      {contact.role && (
                        <p className="text-xs text-gray-500">{contact.role}</p>
                      )}
                    </div>
                  </div>
                  <div className={`w-12 h-7 rounded-full transition-colors relative ${
                    entry.enabled ? 'bg-purple-600' : 'bg-gray-300'
                  }`}>
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all shadow ${
                      entry.enabled ? 'right-1' : 'left-1'
                    }`}></div>
                  </div>
                </button>

                {/* Expanded Form */}
                {entry.enabled && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                    {/* Duty Type Toggle */}
                    <label className="block text-xs font-bold text-gray-600 mb-2">סוג תורנות:</label>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <button
                        onClick={() => updateEntry(contact.id, { dutyType: 'oncall' })}
                        className={`py-3 px-2 rounded-xl text-center transition-all border-2 ${
                          entry.dutyType === 'oncall'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-200'
                        }`}
                      >
                        <div className="text-xl">📞</div>
                        <div className="text-sm font-bold">כונן</div>
                        <div className="text-xs opacity-75">זמין טלפונית</div>
                      </button>
                      <button
                        onClick={() => updateEntry(contact.id, { dutyType: 'sleep' })}
                        className={`py-3 px-2 rounded-xl text-center transition-all border-2 ${
                          entry.dutyType === 'sleep'
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-white text-gray-700 border-gray-200'
                        }`}
                      >
                        <div className="text-xl">🏢</div>
                        <div className="text-sm font-bold">לן בעירייה</div>
                        <div className="text-xs opacity-75">נוכח פיזית</div>
                      </button>
                    </div>

                    {/* Shift Presets */}
                    <label className="block text-xs font-bold text-gray-600 mb-2">משמרת:</label>
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {SHIFT_PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          onClick={() => selectPreset(contact.id, idx)}
                          className={`py-2 px-1 rounded-xl text-center transition-all border-2 ${
                            entry.presetIndex === idx
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white text-gray-700 border-gray-200'
                          }`}
                        >
                          <div className="text-lg">{preset.icon}</div>
                          <div className="text-xs font-bold">{preset.label}</div>
                        </button>
                      ))}
                    </div>

                    {/* Custom Hours (show if no preset match or always show time preview) */}
                    <div className="flex items-center gap-2 mb-4 bg-gray-50 p-3 rounded-xl">
                      <div className="flex-1 text-center">
                        <label className="block text-xs text-gray-500 mb-1">מ-</label>
                        <select
                          value={entry.customStart}
                          onChange={(e) => updateEntry(contact.id, {
                            customStart: parseInt(e.target.value),
                            presetIndex: -1
                          })}
                          className="w-full px-2 py-2 border-2 border-gray-200 rounded-lg text-center font-bold text-lg bg-white"
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i}>
                              {String(i).padStart(2, '0')}:00
                            </option>
                          ))}
                        </select>
                      </div>
                      <span className="text-2xl text-gray-400 pt-5">→</span>
                      <div className="flex-1 text-center">
                        <label className="block text-xs text-gray-500 mb-1">עד-</label>
                        <select
                          value={entry.customEnd}
                          onChange={(e) => updateEntry(contact.id, {
                            customEnd: parseInt(e.target.value),
                            presetIndex: -1
                          })}
                          className="w-full px-2 py-2 border-2 border-gray-200 rounded-lg text-center font-bold text-lg bg-white"
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i}>
                              {String(i).padStart(2, '0')}:00
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Days Selection */}
                    <label className="block text-xs font-bold text-gray-600 mb-2">ימים:</label>
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {DAYS.map((day, i) => (
                        <button
                          key={i}
                          onClick={() => toggleDay(contact.id, i)}
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

                    {/* Quick select buttons */}
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => updateEntry(contact.id, { selectedDays: [0,1,2,3,4] })}
                        className="text-xs px-3 py-1 rounded-full bg-purple-100 text-purple-700 font-semibold"
                      >
                        א׳-ה׳
                      </button>
                      <button
                        onClick={() => updateEntry(contact.id, { selectedDays: [0,1,2,3,4,5,6] })}
                        className="text-xs px-3 py-1 rounded-full bg-purple-100 text-purple-700 font-semibold"
                      >
                        כל השבוע
                      </button>
                      <button
                        onClick={() => updateEntry(contact.id, { selectedDays: [5,6] })}
                        className="text-xs px-3 py-1 rounded-full bg-purple-100 text-purple-700 font-semibold"
                      >
                        סופ"ש
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border-2 border-red-200 rounded-xl text-center">
            <p className="text-red-700 font-semibold">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="mt-6 sticky bottom-4">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-2xl text-lg shadow-lg transition-all active:scale-95"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                שומר...
              </span>
            ) : (
              'שמור כוננויות'
            )}
          </button>
        </div>

        {/* Summary */}
        {contactEntries.filter(e => e.enabled).length > 0 && (
          <div className="mt-4 p-3 bg-purple-50 rounded-xl text-center">
            <p className="text-sm text-purple-700 font-semibold">
              {contactEntries.filter(e => e.enabled && e.dutyType === 'oncall').length} כוננים |{' '}
              {contactEntries.filter(e => e.enabled && e.dutyType === 'sleep').length} לנים בעירייה |{' '}
              {contactEntries
                .filter(e => e.enabled)
                .reduce((sum, e) => sum + e.selectedDays.length, 0)
              } משמרות סה״כ
            </p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6 mb-4">
          מקלטון - מערכת ניהול כוננויות
        </p>
      </div>
    </div>
  );
}
