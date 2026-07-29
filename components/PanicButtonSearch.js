'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const CATEGORY_LABELS = {
  kindergarten: { label: 'גן ילדים', color: 'bg-yellow-100 text-yellow-800', icon: '🧒' },
  school: { label: 'בית ספר', color: 'bg-blue-100 text-blue-800', icon: '🏫' },
  community: { label: 'מרכז קהילתי', color: 'bg-green-100 text-green-800', icon: '🏛️' },
  public: { label: 'מבנה ציבורי', color: 'bg-purple-100 text-purple-800', icon: '🏢' },
  park: { label: 'גן / פארק', color: 'bg-emerald-100 text-emerald-800', icon: '🌳' },
  other: { label: 'אחר', color: 'bg-gray-100 text-gray-700', icon: '📍' },
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, meta]) => ({ value, ...meta }));

function ContactRow({ contact, onChange, onRemove }) {
  return (
    <div className="flex gap-2 items-center">
      <input
        className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900"
        placeholder="שם"
        value={contact.name || ''}
        onChange={e => onChange({ ...contact, name: e.target.value })}
      />
      <input
        className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm ltr text-gray-900"
        placeholder="טלפון"
        value={contact.phone || ''}
        onChange={e => onChange({ ...contact, phone: e.target.value })}
      />
      <input
        className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900"
        placeholder="תפקיד"
        value={contact.role || ''}
        onChange={e => onChange({ ...contact, role: e.target.value })}
      />
      <button
        onClick={onRemove}
        className="text-red-400 hover:text-red-600 text-lg leading-none"
        title="הסר איש קשר"
      >×</button>
    </div>
  );
}

function NewButtonModal({ onClose, onCreated }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'kindergarten',
    address: '',
    directions: '',
    contacts: [{ name: '', phone: '', role: '' }],
    operator_instructions: '',
  });

  const updateContact = (i, val) => {
    setForm(f => {
      const c = [...f.contacts];
      c[i] = val;
      return { ...f, contacts: c };
    });
  };

  const removeContact = (i) => {
    setForm(f => ({ ...f, contacts: f.contacts.filter((_, idx) => idx !== i) }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.address.trim()) {
      alert('שם וכתובת הם שדות חובה');
      return;
    }
    setSaving(true);
    try {
      const cleanContacts = form.contacts.filter(c => c.name.trim() || c.phone.trim());
      const res = await fetch('/api/panic-buttons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, contacts: cleanContacts }),
      });
      const data = await res.json();
      if (data.success) {
        if (onCreated) onCreated(data.button);
        onClose();
      } else {
        alert('שגיאה בשמירה: ' + (data.error || 'לא ידוע'));
      }
    } catch {
      alert('שגיאה בשמירה');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-l from-slate-700 to-slate-800 px-5 py-4 rounded-t-2xl flex items-center justify-between">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <span>➕</span> הוסף לחצן מצוקה חדש
          </h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none px-1">×</button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">שם המיקום *</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
              placeholder="לדוגמה: גן ילדים ברוש"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">קטגוריה</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            >
              {CATEGORY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.icon} {o.label}</option>
              ))}
            </select>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">כתובת *</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
              placeholder="רחוב מספר, עיר"
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            />
          </div>

          {/* Directions */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">דרך הגעה <span className="text-gray-400 font-normal">(אופציונלי)</span></label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-slate-500"
              rows={2}
              placeholder="למשל: ברחוב ברכב עד הסוף ולחצות"
              value={form.directions}
              onChange={e => setForm(f => ({ ...f, directions: e.target.value }))}
            />
          </div>

          {/* Contacts */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">אנשי קשר</label>
            <div className="space-y-2">
              {form.contacts.map((c, i) => (
                <ContactRow
                  key={i}
                  contact={c}
                  onChange={val => updateContact(i, val)}
                  onRemove={() => removeContact(i)}
                />
              ))}
            </div>
            <button
              onClick={() => setForm(f => ({ ...f, contacts: [...f.contacts, { name: '', phone: '', role: '' }] }))}
              className="text-slate-600 hover:text-slate-800 text-sm font-semibold mt-2"
            >
              + הוסף איש קשר
            </button>
          </div>

          {/* Operator instructions */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">הוראות למוקדן <span className="text-gray-400 font-normal">(אופציונלי)</span></label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-slate-500"
              rows={2}
              placeholder="למשל: אין מענה - לשלוח בדחיפות פיקוח או שיטור למקום"
              value={form.operator_instructions}
              onChange={e => setForm(f => ({ ...f, operator_instructions: e.target.value }))}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {saving ? 'שומר...' : '💾 שמור לחצן חדש'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailCard({ button, onClose, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    if (button) {
      setForm({
        name: button.name || '',
        category: button.category || 'other',
        address: button.address || '',
        directions: button.directions || '',
        contacts: Array.isArray(button.contacts) ? button.contacts.map(c => ({...c})) : (typeof button.contacts === 'string' ? JSON.parse(button.contacts) : []),
        operator_instructions: button.operator_instructions || '',
      });
      setEditing(false);
    }
  }, [button?.id]);

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/panic-buttons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: button.id, ...form }),
      });
      const data = await res.json();
      if (data.success) {
        setEditing(false);
        if (onSaved) onSaved(data.button);
      } else {
        alert('שגיאה בשמירה: ' + (data.error || 'לא ידוע'));
      }
    } catch {
      alert('שגיאה בשמירה');
    }
    setSaving(false);
  };

  const addContact = () => {
    setForm(f => ({ ...f, contacts: [...f.contacts, { name: '', phone: '', role: '' }] }));
  };

  const updateContact = (i, val) => {
    setForm(f => {
      const c = [...f.contacts];
      c[i] = val;
      return { ...f, contacts: c };
    });
  };

  const removeContact = (i) => {
    setForm(f => ({ ...f, contacts: f.contacts.filter((_, idx) => idx !== i) }));
  };

  if (!button || !form) return null;

  const cat = CATEGORY_LABELS[button.category] || CATEGORY_LABELS.other;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-l from-red-700 to-red-800 px-5 py-4 rounded-t-2xl flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🆘</span>
              {editing ? (
                <input
                  className="text-gray-900 font-bold text-lg bg-white border border-white/40 rounded-lg px-2 py-0.5 w-48"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              ) : (
                <h2 className="text-white font-bold text-lg">{button.name}</h2>
              )}
            </div>
            {editing ? (
              <select
                className="text-sm bg-white/20 border border-white/30 text-white rounded-lg px-2 py-1 mt-1"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              >
                {CATEGORY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value} className="text-black">{o.icon} {o.label}</option>
                ))}
              </select>
            ) : (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cat.color}`}>
                {cat.icon} {cat.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-white text-red-700 font-bold text-sm px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-60 transition-colors"
                >
                  {saving ? 'שומר...' : '💾 שמור'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="text-white/70 hover:text-white text-sm px-2 py-1.5"
                >
                  ביטול
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="bg-white/10 hover:bg-white/20 text-white text-sm px-3 py-1.5 rounded-lg transition-colors border border-white/20"
              >
                ✏️ עריכה
              </button>
            )}
            <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none px-1">×</button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Address */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 font-semibold mb-1">📍 כתובת</p>
            {editing ? (
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              />
            ) : (
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-gray-900">{button.address}</p>
                <button
                  onClick={() => handleCopy(button.address, 'address')}
                  className="text-xs text-blue-600 hover:text-blue-800 shrink-0"
                >
                  {copied === 'address' ? '✓ הועתק' : 'העתק'}
                </button>
              </div>
            )}
          </div>

          {/* Directions */}
          {(editing || button.directions) && (
            <div className="bg-amber-50 rounded-xl p-4">
              <p className="text-xs text-amber-700 font-semibold mb-1">🗺️ דרך הגעה</p>
              {editing ? (
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none text-gray-900"
                  rows={2}
                  placeholder="אופציונלי..."
                  value={form.directions}
                  onChange={e => setForm(f => ({ ...f, directions: e.target.value }))}
                />
              ) : (
                <p className="text-sm text-amber-900">{button.directions}</p>
              )}
            </div>
          )}

          {/* Contacts */}
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-xs text-blue-700 font-semibold mb-2">📞 אנשי קשר</p>
            {editing ? (
              <div className="space-y-2">
                {form.contacts.map((c, i) => (
                  <ContactRow
                    key={i}
                    contact={c}
                    onChange={val => updateContact(i, val)}
                    onRemove={() => removeContact(i)}
                  />
                ))}
                <button
                  onClick={addContact}
                  className="text-blue-600 hover:text-blue-800 text-sm font-semibold mt-1"
                >
                  + הוסף איש קשר
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {(button.contacts || []).length === 0 && (
                  <p className="text-sm text-gray-400 italic">לא הוגדרו אנשי קשר</p>
                )}
                {(button.contacts || []).map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <div>
                      <span className="font-semibold text-gray-900 text-sm">{c.name}</span>
                      {c.role && <span className="text-gray-500 text-xs mr-1">({c.role})</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm ltr text-blue-800">{c.phone}</span>
                      <button
                        onClick={() => handleCopy(c.phone, `phone-${i}`)}
                        className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-1.5 py-0.5"
                      >
                        {copied === `phone-${i}` ? '✓' : 'העתק'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Operator instructions */}
          {(editing || button.operator_instructions) && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-xs text-red-700 font-semibold mb-1">⚠️ הוראות למוקדן</p>
              {editing ? (
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none text-gray-900"
                  rows={3}
                  placeholder="הוראות מיוחדות..."
                  value={form.operator_instructions}
                  onChange={e => setForm(f => ({ ...f, operator_instructions: e.target.value }))}
                />
              ) : (
                <p className="text-sm text-red-800 font-medium">{button.operator_instructions}</p>
              )}
            </div>
          )}

          {editing && !button.directions && !form.directions && (
            <button
              onClick={() => setForm(f => ({ ...f, directions: ' ' }))}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              + הוסף דרך הגעה
            </button>
          )}
          {editing && !button.operator_instructions && !form.operator_instructions && (
            <button
              onClick={() => setForm(f => ({ ...f, operator_instructions: ' ' }))}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              + הוסף הוראות למוקדן
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PanicButtonSearch() {
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
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/panic-buttons?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.buttons || []);
      setOpen(true);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setHighlightedIndex(-1);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 180);
  };

  const handlePrint = async () => {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/panic-buttons');
      const data = await res.json();
      const buttons = (data.buttons || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'he'));

      const esc = (s) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
      const parseContacts = (c) => {
        if (Array.isArray(c)) return c;
        if (typeof c === 'string') { try { return JSON.parse(c); } catch { return []; } }
        return [];
      };

      const rows = buttons.map(b => {
        const cat = CATEGORY_LABELS[b.category] || CATEGORY_LABELS.other;
        const contacts = parseContacts(b.contacts)
          .filter(c => c && (c.name || c.phone))
          .map(c => `${esc(c.name || '')}${c.role ? ' (' + esc(c.role) + ')' : ''}${c.phone ? ' — ' + esc(c.phone) : ''}`)
          .join('<br>');
        return `
        <tr>
          <td style="font-weight:bold">${esc(b.name)}</td>
          <td style="text-align:center">${esc(cat.label)}</td>
          <td>${esc(b.address)}</td>
          <td>${contacts || '<span style="color:#999">—</span>'}</td>
          <td>${esc(b.operator_instructions || '')}</td>
          <td class="note">&nbsp;</td>
        </tr>`;
      }).join('');

      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html dir="rtl"><head><title>לחצני מצוקה - יהוד-מונוסון</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; margin: 10px; direction: rtl; font-size: 11px; color: #111; background: #fff; }
          @page { margin: 0.6cm; size: A4; }
          table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; background: #f0f0f0; }
          th, td { border: 1px solid #999; padding: 5px 7px; vertical-align: top; }
          th { text-align: right; }
          td.note { background: #fff; height: 30px; }
          .head { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
        </style></head>
        <body>
          <div class="head">
            <h1 style="font-size:18px;margin:0">🆘 לחצני מצוקה - יהוד-מונוסון</h1>
            <p style="font-size:11px;color:#666;margin:4px 0 0 0">${new Date().toLocaleDateString('he-IL')} · ${buttons.length} לחצנים</p>
          </div>
          <table>
            <thead><tr>
              <th style="width:17%">שם</th>
              <th style="width:11%;text-align:center">קטגוריה</th>
              <th style="width:18%">כתובת</th>
              <th style="width:22%">אנשי קשר</th>
              <th style="width:16%">הוראות למוקדן</th>
              <th style="width:16%">הערות</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </body></html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    } catch {
      alert('שגיאה בהפקת ההדפסה');
    }
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
      if (highlightedIndex >= 0 && results[highlightedIndex]) {
        handleSelect(results[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const handleSelect = (btn) => {
    setSelected(btn);
    setQuery('');
    setOpen(false);
    setResults([]);
    setHighlightedIndex(-1);
  };

  const handleSaved = (updated) => {
    setSelected(updated);
  };

  const handleCreated = (newBtn) => {
    setSelected(newBtn);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        inputRef.current && !inputRef.current.contains(e.target)
      ) {
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
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-red-300 text-sm pointer-events-none select-none">🆘</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            onFocus={() => query.trim() && setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="חיפוש לחצן מצוקה..."
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
            {results.map((btn, idx) => {
              const cat = CATEGORY_LABELS[btn.category] || CATEGORY_LABELS.other;
              const isHighlighted = idx === highlightedIndex;
              return (
                <button
                  key={btn.id}
                  ref={el => itemRefs.current[idx] = el}
                  onClick={() => handleSelect(btn)}
                  className={`w-full text-right px-4 py-3 flex items-center justify-between gap-3 border-b border-gray-100 last:border-0 transition-colors ${
                    isHighlighted ? 'bg-red-50 border-r-2 border-r-red-400' : 'hover:bg-red-50'
                  }`}
                >
                  <div>
                    <p className={`font-semibold text-sm ${isHighlighted ? 'text-red-700' : 'text-gray-900'}`}>{btn.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{btn.address}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${cat.color}`}>
                    {cat.icon}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {open && !loading && results.length === 0 && query.trim() && (
          <div
            ref={dropdownRef}
            className="absolute top-full right-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50 px-4 py-3 text-sm text-gray-400 text-center"
          >
            לא נמצאו תוצאות
          </div>
        )}
      </div>

      <button
        onClick={handlePrint}
        className="shrink-0 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1"
        title="הדפס לחצני מצוקה (PDF)"
      >
        🖨️
      </button>

      <button
        onClick={() => setShowNew(true)}
        className="shrink-0 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1"
        title="הוסף לחצן מצוקה חדש"
      >
        ＋
      </button>

      {selected && (
        <DetailCard
          button={selected}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
        />
      )}

      {showNew && (
        <NewButtonModal
          onClose={() => setShowNew(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
