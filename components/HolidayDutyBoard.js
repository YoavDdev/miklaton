'use client';

import { useMemo, useState } from 'react';

/**
 * תצוגת לוח החג. רכיב טהור - לא שולף בעצמו, כדי שגם דף המוקדן וגם מסך הקיר
 * יציגו בדיוק את אותו דבר ולא יסטו זה מזה עם הזמן.
 */
export default function HolidayDutyBoard({ period, topics = [], isActive = false, compact = false }) {
  const [search, setSearch] = useState('');

  const todayIso = useMemo(
    () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }),
    []
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return topics;
    const term = search.trim().toLowerCase();
    return topics
      .map((t) => ({
        ...t,
        entries: t.entries.filter(
          (e) =>
            e.contact_name.toLowerCase().includes(term) ||
            (e.subtopic || '').toLowerCase().includes(term) ||
            (e.note || '').toLowerCase().includes(term)
        ),
      }))
      .filter((t) => t.name.toLowerCase().includes(term) || t.entries.length > 0);
  }, [search, topics]);

  if (!period) {
    return (
      <div className="p-6 text-center text-gray-500" dir="rtl">
        אין חג מוגדר כרגע.
      </div>
    );
  }

  /** שורה ריקה ב-applies_dates חלה על כל ימי החג. */
  const appliesToday = (entry) =>
    !entry.applies_dates?.length || entry.applies_dates.includes(todayIso);

  return (
    <div dir="rtl" className="space-y-3">
      <div className={`rounded-2xl px-4 py-3 ${isActive ? 'bg-amber-600' : 'bg-slate-800'}`}>
        <div className="text-white font-bold text-lg">
          {isActive ? '🕯️ מצב חג פעיל' : '🕯️ לוח כוננות חג'} — {period.name}
        </div>
        <div className="text-white/80 text-sm">
          כוננות {fmtDate(period.duty_start)} עד {fmtDate(period.duty_end)}
        </div>
        <div className="text-white/60 text-xs">
          החג עצמו: {fmt(period.starts_at)} עד {fmt(period.ends_at)}
        </div>
        {period.notes && <div className="text-white/90 text-sm mt-1">{period.notes}</div>}
      </div>

      {!compact && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש נושא, שם או הערה..."
          className="no-print w-full rounded-xl border border-gray-300 px-4 py-2.5 text-right"
        />
      )}

      {filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-gray-400">
          {topics.length === 0 ? 'הלוח עדיין ריק' : 'אין תוצאות לחיפוש'}
        </div>
      )}

      {filtered.map((topic) => (
        <div key={topic.id} className="print-block bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="bg-slate-100 px-4 py-2 flex items-center justify-between gap-2">
            <span className="font-bold text-gray-900">{topic.name}</span>
            {topic.status === 'pending' && (
              <span className="text-xs text-amber-700 bg-amber-100 rounded-full px-2 py-0.5 whitespace-nowrap">
                טרם עודכן מהמחלקה
              </span>
            )}
          </div>
          {topic.instructions && (
            <div className="px-4 py-2 text-sm text-gray-800 bg-amber-50 border-r-4 border-amber-400">
              {topic.instructions}
            </div>
          )}
          <div className="divide-y divide-gray-100">
            {topic.entries.map((e) => (
              <div key={e.id} className={`px-4 py-2.5 ${appliesToday(e) ? '' : 'opacity-40'}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400">{e.order_index}</span>
                  {e.subtopic && (
                    <span className="text-xs bg-slate-200 text-slate-700 rounded px-1.5 py-0.5">
                      {e.subtopic}
                    </span>
                  )}
                  <span className="font-semibold text-gray-900">{e.contact_name}</span>
                  {e.contact_role && <span className="text-xs text-gray-500">{e.contact_role}</span>}
                  {e.contact_phone ? (
                    <a
                      href={`tel:${e.contact_phone}`}
                      className="mr-auto text-blue-600 font-mono text-sm"
                    >
                      {e.contact_phone}
                    </a>
                  ) : (
                    <span className="mr-auto text-xs text-red-600">אין טלפון</span>
                  )}
                </div>
                {e.split_note && <div className="text-xs text-purple-700 mt-1">⚖️ {e.split_note}</div>}
                {e.requires_approval_from && (
                  <div className="text-xs text-red-700 mt-1">
                    🔒 רק באישור {e.requires_approval_from}
                  </div>
                )}
                {e.note && <div className="text-xs text-gray-600 mt-1">{e.note}</div>}
                {!appliesToday(e) && (
                  <div className="text-xs text-gray-400 mt-1">
                    לא רלוונטי היום · {e.applies_dates.join(', ')}
                  </div>
                )}
              </div>
            ))}
            {topic.entries.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-400">אין כוננים מוגדרים</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function fmtDate(isoDate) {
  if (!isoDate) return '';
  return new Date(`${isoDate}T12:00:00+03:00`).toLocaleDateString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  });
}

function fmt(iso) {
  return new Date(iso).toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
