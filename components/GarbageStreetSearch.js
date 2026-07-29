'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const DAYS = [
  { value: 'sunday', label: 'ראשון' },
  { value: 'monday', label: 'שני' },
  { value: 'tuesday', label: 'שלישי' },
  { value: 'wednesday', label: 'רביעי' },
  { value: 'thursday', label: 'חמישי' },
  { value: 'friday', label: 'שישי' },
];

const TAKEOUT_MAP = {
  'sunday': 'שבת',
  'monday': 'ראשון',
  'tuesday': 'שני',
  'wednesday': 'שלישי',
  'thursday': 'רביעי',
  'friday': 'חמישי',
};

function groupEntriesByStreet(entries) {
  const grouped = new Map();

  entries.forEach((entry) => {
    const key = `${entry.street_name}__${entry.zone || ''}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        id: key,
        street_name: entry.street_name,
        zone: entry.zone || 'יהוד',
        notes: entry.notes || '',
        entries: [],
      });
    }

    const current = grouped.get(key);
    current.entries.push(entry);
    if (!current.notes && entry.notes) current.notes = entry.notes;
  });

  return Array.from(grouped.values()).map((group) => ({
    ...group,
    entries: group.entries.sort((a, b) => DAYS.findIndex(d => d.value === a.collection_day) - DAYS.findIndex(d => d.value === b.collection_day)),
  }));
}

function NewEntryModal({ onClose, onCreated }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    street_name: '',
    collection_day: 'monday',
    zone: 'יהוד',
    notes: '',
  });

  const handleSave = async () => {
    if (!form.street_name.trim()) { alert('שם רחוב הוא שדה חובה'); return; }
    setSaving(true);
    try {
      const day = DAYS.find(d => d.value === form.collection_day);
      const res = await fetch('/api/garbage-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          street_name: form.street_name,
          collection_day: form.collection_day,
          collection_day_hebrew: day?.label || '',
          takeout_day_hebrew: TAKEOUT_MAP[form.collection_day] || '',
          zone: form.zone,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (data.success) { onCreated(data.entry); onClose(); }
      else alert('שגיאה: ' + (data.error || 'לא ידוע'));
    } catch { alert('שגיאה בשמירה'); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-l from-green-600 to-green-700 px-5 py-4 rounded-t-2xl flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">➕ הוסף רחוב ללוח גזם</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none px-1">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">שם רחוב *</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
              placeholder="לדוגמה: הרצל"
              value={form.street_name}
              onChange={e => setForm(f => ({ ...f, street_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">יום פינוי</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
              value={form.collection_day}
              onChange={e => setForm(f => ({ ...f, collection_day: e.target.value }))}
            >
              {DAYS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">אזור</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
              value={form.zone}
              onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}
            >
              <option value="יהוד">יהוד</option>
              <option value="מונוסון">מונוסון</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">הערות <span className="text-gray-400 font-normal">(אופציונלי)</span></label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
              placeholder="הערות נוספות..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs text-green-700 font-medium">
              🗓️ יום הוצאה: <strong>{TAKEOUT_MAP[form.collection_day]}</strong> (יום לפני הפינוי)
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {saving ? 'שומר...' : '💾 שמור'}
            </button>
            <button onClick={onClose} className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
              ביטול
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailCard({ streetGroup, onClose, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (streetGroup) {
      setForm({
        street_name: streetGroup.street_name || '',
        zone: streetGroup.zone || 'יהוד',
        notes: streetGroup.notes || '',
        entries: (streetGroup.entries || []).map((entry) => ({
          id: entry.id,
          collection_day: entry.collection_day || 'monday',
          collection_day_hebrew: entry.collection_day_hebrew || '',
          takeout_day_hebrew: entry.takeout_day_hebrew || '',
          notes: entry.notes || '',
        })),
      });
      setEditing(false);
    }
  }, [streetGroup?.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedEntries = [];

      for (const entryForm of form.entries) {
        const day = DAYS.find(d => d.value === entryForm.collection_day);
        const res = await fetch('/api/garbage-collection', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: entryForm.id,
            street_name: form.street_name,
            zone: form.zone,
            notes: entryForm.notes || form.notes,
            collection_day: entryForm.collection_day,
            collection_day_hebrew: day?.label || entryForm.collection_day_hebrew,
            takeout_day_hebrew: TAKEOUT_MAP[entryForm.collection_day] || entryForm.takeout_day_hebrew,
          }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'לא ידוע');
        }
        updatedEntries.push(data.entry);
      }

      setEditing(false);
      onSaved(groupEntriesByStreet(updatedEntries)[0]);
    } catch { alert('שגיאה בשמירה'); }
    setSaving(false);
  };

  if (!streetGroup || !form) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-l from-green-600 to-green-700 px-5 py-4 rounded-t-2xl flex items-start justify-between">
          <div>
            {editing ? (
              <input
                className="text-gray-900 font-bold text-lg bg-white border border-white/40 rounded-lg px-2 py-0.5 w-48"
                value={form.street_name}
                onChange={e => setForm(f => ({ ...f, street_name: e.target.value }))}
              />
            ) : (
              <h2 className="text-white font-bold text-lg flex items-center gap-2">
                <span>🗑️</span> {streetGroup.street_name}
              </h2>
            )}
            <span className={`inline-block mt-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${streetGroup.zone === 'מונוסון' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
              {streetGroup.zone}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-white text-green-700 font-bold text-sm px-3 py-1.5 rounded-lg hover:bg-green-50 disabled:opacity-60"
                >
                  {saving ? 'שומר...' : '💾 שמור'}
                </button>
                <button onClick={() => setEditing(false)} className="text-white/70 hover:text-white text-sm px-2 py-1.5">ביטול</button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="bg-white/10 hover:bg-white/20 text-white text-sm px-3 py-1.5 rounded-lg border border-white/20"
              >
                ✏️ עריכה
              </button>
            )}
            <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none px-1">×</button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="bg-green-50 rounded-xl p-4">
            <p className="text-xs text-green-700 font-semibold mb-3">🗓️ ימי פינוי והוצאה</p>
            <div className="space-y-3">
              {form.entries.map((entryForm, index) => {
                const dayLabel = DAYS.find(d => d.value === entryForm.collection_day)?.label || entryForm.collection_day_hebrew;
                const takeoutLabel = TAKEOUT_MAP[entryForm.collection_day] || entryForm.takeout_day_hebrew;

                return (
                  <div key={entryForm.id} className="bg-white rounded-lg border border-green-100 p-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">יום פינוי</p>
                        {editing ? (
                          <select
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                            value={entryForm.collection_day}
                            onChange={e => {
                              const day = DAYS.find(d => d.value === e.target.value);
                              setForm(f => ({
                                ...f,
                                entries: f.entries.map((item, itemIndex) => itemIndex === index ? {
                                  ...item,
                                  collection_day: e.target.value,
                                  collection_day_hebrew: day?.label || '',
                                  takeout_day_hebrew: TAKEOUT_MAP[e.target.value] || '',
                                } : item),
                              }));
                            }}
                          >
                            {DAYS.map(d => (
                              <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-lg font-bold text-green-800">יום {dayLabel}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">יום הוצאה</p>
                        <p className="text-lg font-bold text-blue-800">יום {takeoutLabel}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Zone */}
          {editing && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">אזור</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.zone}
                onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}
              >
                <option value="יהוד">יהוד</option>
                <option value="מונוסון">מונוסון</option>
              </select>
            </div>
          )}

          {/* Notes */}
          {(editing || streetGroup.notes || form.entries.some(item => item.notes)) && (
            <div className="bg-amber-50 rounded-xl p-4">
              <p className="text-xs text-amber-700 font-semibold mb-1">📝 הערות</p>
              {editing ? (
                <div className="space-y-2">
                  {form.entries.map((entryForm, index) => (
                    <input
                      key={entryForm.id}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                      value={entryForm.notes}
                      onChange={e => setForm(f => ({
                        ...f,
                        entries: f.entries.map((item, itemIndex) => itemIndex === index ? { ...item, notes: e.target.value } : item),
                      }))}
                      placeholder={`הערות לרשומה ${index + 1}`}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {streetGroup.entries.filter(item => item.notes).map((item) => (
                    <p key={item.id} className="text-sm text-amber-900">
                      יום {item.collection_day_hebrew}: {item.notes}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Contact info */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 font-semibold mb-2">📞 אנשי קשר תברואה</p>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">שמשון</span>
                <a href="tel:050-6917771" className="text-sm text-blue-600 font-mono">050-6917771</a>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">יוסי מססה</span>
                <a href="tel:050-8440888" className="text-sm text-blue-600 font-mono">050-8440888</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GarbageStreetSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);
  const itemRefs = useRef([]);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/garbage-collection?street=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(groupEntriesByStreet(data.schedule || []));
      setOpen(true);
    } catch { setResults([]); }
    setLoading(false);
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setHighlightedIndex(-1);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 180);
  };

  const handleKeyDown = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => {
        const next = Math.min(i + 1, results.length - 1);
        itemRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => {
        const prev = Math.max(i - 1, 0);
        itemRefs.current[prev]?.scrollIntoView({ block: 'nearest' });
        return prev;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && results[highlightedIndex]) handleSelect(results[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const handleSelect = (streetGroup) => {
    setSelected(streetGroup);
    setQuery('');
    setOpen(false);
    setResults([]);
    setHighlightedIndex(-1);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <>
      <div className="relative flex items-center gap-1" dir="rtl">
        <div className="relative w-52">
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-300 text-sm pointer-events-none select-none">🗑️</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            onFocus={() => query.trim() && setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="חיפוש רחוב גזם..."
            className="w-full bg-white/10 border border-white/20 text-white placeholder-white/50 rounded-lg pr-8 pl-3 py-1.5 text-sm focus:outline-none focus:bg-white/20 focus:border-white/40 transition-all"
          />
          {loading && (
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/60 text-xs animate-spin">⟳</span>
          )}
        </div>

        {open && results.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute top-full right-0 mt-1 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden"
          >
            {results.map((entry, idx) => {
              const isHighlighted = idx === highlightedIndex;
              return (
                <button
                  key={entry.id}
                  ref={el => itemRefs.current[idx] = el}
                  onClick={() => handleSelect(entry)}
                  className={`w-full text-right px-4 py-3 flex items-center justify-between gap-3 border-b border-gray-100 last:border-0 transition-colors ${
                    isHighlighted ? 'bg-green-50 border-r-2 border-r-green-400' : 'hover:bg-green-50'
                  }`}
                >
                  <div>
                    <p className={`font-semibold text-sm ${isHighlighted ? 'text-green-700' : 'text-gray-900'}`}>
                      {entry.street_name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {entry.entries.map(item => `פינוי ${item.collection_day_hebrew} / הוצאה ${item.takeout_day_hebrew || TAKEOUT_MAP[item.collection_day] || '-'}`).join(' • ')}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${entry.zone === 'מונוסון' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {entry.zone}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {open && !loading && results.length === 0 && query.trim() && (
          <div ref={dropdownRef} className="absolute top-full right-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50 px-4 py-3 text-sm text-gray-400 text-center">
            לא נמצאו תוצאות
          </div>
        )}
      </div>

      <button
        onClick={() => setShowNew(true)}
        className="shrink-0 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1"
        title="הוסף רחוב ללוח גזם"
      >
        ＋
      </button>

      {selected && (
        <DetailCard
          streetGroup={selected}
          onClose={() => setSelected(null)}
          onSaved={(updated) => setSelected(updated)}
        />
      )}

      {showNew && (
        <NewEntryModal
          onClose={() => setShowNew(false)}
          onCreated={(entry) => setSelected(groupEntriesByStreet([entry])[0])}
        />
      )}
    </>
  );
}
