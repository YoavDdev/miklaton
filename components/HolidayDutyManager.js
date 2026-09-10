'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { getMunicipalityId } from '@/lib/municipality';

/**
 * ימי חלון הכוננות לבחירה ב-applies_dates.
 * החלון מגיע מהשרת (duty_start/duty_end) כדי שהעורך והלוח יסכימו תמיד.
 */
function windowDates(period) {
  if (!period?.duty_start || !period?.duty_end) return [];
  const out = [];
  const step = (d) => {
    const t = new Date(`${d}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + 1);
    return t.toISOString().slice(0, 10);
  };
  let cur = period.duty_start;
  for (let i = 0; cur <= period.duty_end && i < 60; i += 1) {
    out.push(cur);
    cur = step(cur);
  }
  return out;
}

function dayLabel(iso) {
  const d = new Date(`${iso}T12:00:00+03:00`);
  return d.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });
}

const EMPTY_ENTRY = {
  subtopic: '',
  contact_name: '',
  contact_phone: '',
  contact_role: '',
  source_contact_id: null,
  source_table: null,
  order_index: 1,
  applies_dates: [],
  split_note: '',
  requires_approval_from: '',
  note: '',
};

export default function HolidayDutyManager() {
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState('');
  const [board, setBoard] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { topicId, entry }
  const [newTopic, setNewTopic] = useState('');
  const [noteEdit, setNoteEdit] = useState(null); // { topicId, text }
  const [seedSource, setSeedSource] = useState('');
  const mid = getMunicipalityId();

  const loadBoard = useCallback(
    async (id) => {
      const res = await fetch(`/api/holiday-duty?municipality_id=${mid}&period=${id || 'active'}`);
      const json = await res.json();
      if (json.success) {
        setBoard(json);
        if (!id && json.period) setPeriodId(json.period.id);
      } else {
        toast.error(json.error || 'שגיאה בטעינת הלוח');
      }
    },
    [mid]
  );

  useEffect(() => {
    (async () => {
      const [p, c] = await Promise.all([
        fetch(`/api/holiday-duty/periods?municipality_id=${mid}`).then((r) => r.json()),
        fetch(`/api/holiday-duty/contacts?municipality_id=${mid}`).then((r) => r.json()),
      ]);
      if (p.success) setPeriods(p.periods);
      if (c.success) setContacts(c.contacts);
      await loadBoard('');
      setLoading(false);
    })();
  }, [mid, loadBoard]);

  const dates = useMemo(() => windowDates(board?.period), [board]);

  /** החג האחרון שכבר מולא, לפי סדר הזמן - המקור המומלץ לשכפול. */
  const lastFilled = useMemo(
    () =>
      periods
        .filter((p) => p.has_board && p.id !== periodId)
        .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at))[0] || null,
    [periods, periodId]
  );

  async function patch(url, body) {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json.success) await loadBoard(periodId);
    else toast.error(json.error);
  }

  const seedFromGuide = async (fromPeriodId) => {
    const res = await fetch(`/api/holiday-duty/periods/${periodId}/seed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ municipality_id: mid, from_period_id: fromPeriodId || undefined }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success(`נוצרו ${json.seeded} נושאים`);
      await loadBoard(periodId);
    } else toast.error(json.error);
  };

  const saveWindow = async (startDate, endDate) => {
    if (startDate && endDate && endDate < startDate) {
      toast.error('תאריך הסיום מוקדם מתאריך ההתחלה');
      return;
    }
    await patch(`/api/holiday-duty/periods/${periodId}`, {
      duty_start_date: startDate || null,
      duty_end_date: endDate || null,
    });
  };

  const addTopic = async () => {
    if (!newTopic.trim()) return;
    const res = await fetch('/api/holiday-duty/topics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        municipality_id: mid,
        holiday_period_id: periodId,
        name: newTopic.trim(),
        display_order: (board?.topics?.length || 0) + 1,
      }),
    });
    const json = await res.json();
    if (json.success) {
      setNewTopic('');
      await loadBoard(periodId);
    } else toast.error(json.error);
  };

  const deleteTopic = async (topicId, name) => {
    if (!confirm(`למחוק את "${name}" ואת כל הכוננים שבו?`)) return;
    await fetch(`/api/holiday-duty/topics/${topicId}`, { method: 'DELETE' });
    await loadBoard(periodId);
  };

  const saveInstructions = async (topicId, text) => {
    await patch(`/api/holiday-duty/topics/${topicId}`, { instructions: text.trim() || null });
    setNoteEdit(null);
  };

  const confirmTopic = async (topic) => {
    const by = prompt('מי מהמחלקה מסר את העדכון?', topic.confirmed_by_name || '');
    if (by === null) return;
    await patch(`/api/holiday-duty/topics/${topic.id}`, {
      status: 'confirmed',
      confirmed_by_name: by,
      confirmed_at: new Date().toISOString(),
    });
  };

  const saveEntry = async () => {
    const { topicId, entry } = editing;
    if (!entry.contact_name?.trim()) {
      toast.error('שם איש קשר חובה');
      return;
    }
    const url = entry.id ? `/api/holiday-duty/entries/${entry.id}` : '/api/holiday-duty/entries';
    const res = await fetch(url, {
      method: entry.id ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...entry, municipality_id: mid, topic_id: topicId }),
    });
    const json = await res.json();
    if (json.success) {
      setEditing(null);
      await loadBoard(periodId);
    } else toast.error(json.error);
  };

  const deleteEntry = async (entryId) => {
    if (!confirm('למחוק את השורה?')) return;
    await fetch(`/api/holiday-duty/entries/${entryId}`, { method: 'DELETE' });
    await loadBoard(periodId);
  };

  const pickContact = (key) => {
    const c = contacts.find((x) => `${x.source_table}:${x.source_contact_id}` === key);
    if (!c) return;
    setEditing((s) => ({
      ...s,
      entry: {
        ...s.entry,
        contact_name: c.name,
        contact_phone: c.phone || '',
        contact_role: c.role || '',
        source_contact_id: c.source_contact_id,
        source_table: c.source_table,
      },
    }));
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center" dir="rtl">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-slate-700" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-4">
      {/* בורר חג */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
        <label className="font-semibold text-gray-700">חג:</label>
        <select
          value={periodId}
          onChange={(e) => {
            setPeriodId(e.target.value);
            loadBoard(e.target.value);
          }}
          className="rounded-xl border border-gray-300 px-3 py-2"
        >
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {new Date(p.starts_at).toLocaleDateString('he-IL')}
            </option>
          ))}
        </select>
        {board?.isActive && (
          <span className="text-sm bg-amber-100 text-amber-800 rounded-full px-3 py-1">
            הכוננות פעילה עכשיו
          </span>
        )}

        <div className="w-full border-t border-gray-100 pt-3 mt-1 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              כוננויות מתאריך
            </label>
            <input
              type="date"
              value={board?.period?.duty_start || ''}
              onChange={(e) => saveWindow(e.target.value, board?.period?.duty_end)}
              className="rounded-xl border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">עד תאריך</label>
            <input
              type="date"
              value={board?.period?.duty_end || ''}
              onChange={(e) => saveWindow(board?.period?.duty_start, e.target.value)}
              className="rounded-xl border border-gray-300 px-3 py-2"
            />
          </div>
          <button
            onClick={() => saveWindow(null, null)}
            className="px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm"
          >
            חזור לימי החג
          </button>
          <p className="text-xs text-gray-500 basis-full">
            {board?.period?.duty_start_date
              ? 'חלון שהוגדר ידנית. הימים שנבחרים לכל כונן נלקחים מהחלון הזה.'
              : `ברירת מחדל לפי ימי החג. אפשר להרחיב - למשל להתחיל כבר ביום שישי בבוקר.`}
          </p>
        </div>
      </div>

      {/* לוח ריק - זריעה. ברירת המחדל היא החג האחרון שמולא, כי הוא כבר
          מדויק; המדריך הגולמי הוא נפילה אחורה לפעם הראשונה בלבד. */}
      {board?.topics?.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <p className="text-gray-600">הלוח ריק. אפשר להתחיל ממה שכבר סידרת:</p>
          <div className="flex flex-wrap gap-2 items-center">
            {lastFilled ? (
              <button
                onClick={() => seedFromGuide(lastFilled.id)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white font-semibold"
              >
                מלא מ{lastFilled.name}
              </button>
            ) : (
              <button
                onClick={() => seedFromGuide(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white font-semibold"
              >
                מלא ממדריך הכוננויות
              </button>
            )}

            <span className="text-gray-400">או</span>

            <select
              value={seedSource}
              onChange={(e) => setSeedSource(e.target.value)}
              className="rounded-xl border border-gray-300 px-3 py-2"
            >
              <option value="">מחג אחר...</option>
              {periods
                .filter((p) => p.id !== periodId && p.has_board)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              <option value="__guide__">ממדריך הכוננויות</option>
            </select>
            <button
              onClick={() => seedSource && seedFromGuide(seedSource === '__guide__' ? null : seedSource)}
              disabled={!seedSource}
              className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold disabled:opacity-40"
            >
              מלא
            </button>
          </div>
          {lastFilled && (
            <p className="text-xs text-gray-500">
              השכפול מביא את הנושאים, הכוננים וההערות. הימים שנבחרו לכל כונן אינם
              מועתקים, כי הם שייכים לתאריכי החג הקודם.
            </p>
          )}
        </div>
      )}

      {/* נושאים */}
      {board?.topics?.map((topic) => (
        <div key={topic.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="bg-slate-100 px-4 py-2.5 flex flex-wrap items-center gap-2">
            <span className="font-bold text-gray-900">{topic.name}</span>
            {topic.status === 'confirmed' ? (
              <span className="text-xs bg-emerald-100 text-emerald-800 rounded-full px-2 py-0.5">
                ✓ עודכן{topic.confirmed_by_name ? ` · ${topic.confirmed_by_name}` : ''}
              </span>
            ) : (
              <span className="text-xs bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">
                ממתין לעדכון
              </span>
            )}
            <div className="mr-auto flex gap-2">
              <button
                onClick={() => confirmTopic(topic)}
                className="text-xs px-2.5 py-1 rounded-lg bg-emerald-600 text-white"
              >
                סמן כעודכן
              </button>
              <button
                onClick={() => setEditing({ topicId: topic.id, entry: { ...EMPTY_ENTRY } })}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-700 text-white"
              >
                + כונן
              </button>
              <button
                onClick={() => deleteTopic(topic.id, topic.name)}
                className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-700"
              >
                מחק נושא
              </button>
              <button
                onClick={() =>
                  setNoteEdit({ topicId: topic.id, text: topic.instructions || '' })
                }
                className="text-xs px-2.5 py-1 rounded-lg bg-gray-200 text-gray-700"
              >
                {topic.instructions ? 'ערוך הערה' : '+ הערה'}
              </button>
            </div>
          </div>

          {noteEdit?.topicId === topic.id ? (
            <div className="px-4 py-3 bg-gray-50 space-y-2">
              <textarea
                autoFocus
                rows={2}
                value={noteEdit.text}
                onChange={(e) => setNoteEdit({ ...noteEdit, text: e.target.value })}
                placeholder={`הערה ל"${topic.name.trim()}" בחג הזה - תוצג למוקדן מתחת לשם הנושא`}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-right"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => saveInstructions(topic.id, noteEdit.text)}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 text-white text-sm font-semibold"
                >
                  שמור
                </button>
                <button
                  onClick={() => setNoteEdit(null)}
                  className="px-4 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-sm"
                >
                  ביטול
                </button>
                {topic.instructions && (
                  <button
                    onClick={() => saveInstructions(topic.id, '')}
                    className="mr-auto px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-sm"
                  >
                    מחק הערה
                  </button>
                )}
              </div>
            </div>
          ) : (
            topic.instructions && (
              <div className="px-4 py-2 text-sm text-gray-700 bg-amber-50 border-r-4 border-amber-400">
                {topic.instructions}
              </div>
            )
          )}

          <div className="divide-y divide-gray-100">
            {topic.entries.map((e) => (
              <div key={e.id} className="px-4 py-2.5 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-400 w-4">{e.order_index}</span>
                {e.subtopic && (
                  <span className="text-xs bg-slate-200 text-slate-700 rounded px-1.5 py-0.5">
                    {e.subtopic}
                  </span>
                )}
                <span className="font-semibold">{e.contact_name}</span>
                <span className="font-mono text-sm text-gray-500">
                  {e.contact_phone || 'אין טלפון'}
                </span>
                {e.applies_dates?.length > 0 && (
                  <span className="text-xs text-blue-700">
                    {e.applies_dates.map(dayLabel).join(', ')}
                  </span>
                )}
                {e.split_note && <span className="text-xs text-purple-700">⚖️ {e.split_note}</span>}
                {e.requires_approval_from && (
                  <span className="text-xs text-red-700">🔒 {e.requires_approval_from}</span>
                )}
                <div className="mr-auto flex gap-2">
                  <button
                    onClick={() => setEditing({ topicId: topic.id, entry: { ...EMPTY_ENTRY, ...e } })}
                    className="text-xs text-blue-600"
                  >
                    ערוך
                  </button>
                  <button onClick={() => deleteEntry(e.id)} className="text-xs text-red-600">
                    מחק
                  </button>
                </div>
              </div>
            ))}
            {topic.entries.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-400">אין כוננים. לחץ "+ כונן".</div>
            )}
          </div>
        </div>
      ))}

      {/* הוספת נושא */}
      {board?.period && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex gap-2">
          <input
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTopic()}
            placeholder="נושא חדש (למשל: ניקיון)"
            className="flex-1 rounded-xl border border-gray-300 px-3 py-2"
          />
          <button onClick={addTopic} className="px-4 py-2 rounded-xl bg-slate-800 text-white font-semibold">
            הוסף נושא
          </button>
        </div>
      )}

      {/* עורך שורה */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-3">
            <h3 className="font-bold text-lg">{editing.entry.id ? 'עריכת כונן' : 'כונן חדש'}</h3>

            <label className="block text-sm font-semibold text-gray-700">בחר מהמערכת</label>
            <select
              onChange={(e) => pickContact(e.target.value)}
              defaultValue=""
              className="w-full rounded-xl border border-gray-300 px-3 py-2"
            >
              <option value="">— בחר איש קשר קיים —</option>
              {contacts.map((c) => (
                <option
                  key={`${c.source_table}:${c.source_contact_id}`}
                  value={`${c.source_table}:${c.source_contact_id}`}
                >
                  {c.name}
                  {c.phone ? ` · ${c.phone}` : ' · אין טלפון'}
                  {c.from ? ` · ${c.from}` : ''}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <Field label="שם" value={editing.entry.contact_name} onChange={(v) => setField('contact_name', v)} />
              <Field label="טלפון" value={editing.entry.contact_phone} onChange={(v) => setField('contact_phone', v)} />
              <Field label="תת-נושא" value={editing.entry.subtopic} onChange={(v) => setField('subtopic', v)} placeholder="פינוי גזם" />
              <Field label="תפקיד" value={editing.entry.contact_role} onChange={(v) => setField('contact_role', v)} placeholder="כונן ראשון" />
            </div>

            <label className="block text-sm font-semibold text-gray-700">סדר הסלמה</label>
            <input
              type="number"
              min="1"
              value={editing.entry.order_index}
              onChange={(e) => setField('order_index', Number(e.target.value))}
              className="w-24 rounded-xl border border-gray-300 px-3 py-2"
            />

            <label className="block text-sm font-semibold text-gray-700">
              ימים בתוך חלון הכוננות (ריק = כל החלון)
            </label>
            <div className="flex flex-wrap gap-2">
              {dates.map((d) => {
                const on = editing.entry.applies_dates?.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      setField(
                        'applies_dates',
                        on
                          ? editing.entry.applies_dates.filter((x) => x !== d)
                          : [...(editing.entry.applies_dates || []), d]
                      )
                    }
                    className={`px-3 py-1.5 rounded-lg text-sm ${
                      on ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {dayLabel(d)}
                  </button>
                );
              })}
            </div>

            <Field label="הערת חלוקה" value={editing.entry.split_note} onChange={(v) => setField('split_note', v)} placeholder="לחלק את הפניות חצי-חצי" />
            <Field label="דורש אישור של" value={editing.entry.requires_approval_from} onChange={(v) => setField('requires_approval_from', v)} placeholder="ליאור לוי" />
            <Field label="הערה למוקדן" value={editing.entry.note} onChange={(v) => setField('note', v)} />

            <div className="flex gap-2 pt-2">
              <button onClick={saveEntry} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-white font-bold">
                שמור
              </button>
              <button onClick={() => setEditing(null)} className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700">
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function setField(key, value) {
    setEditing((s) => ({ ...s, entry: { ...s.entry, [key]: value } }));
  }
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700">{label}</label>
      <input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-300 px-3 py-2"
      />
    </div>
  );
}
