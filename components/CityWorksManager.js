'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

/**
 * ניהול שוטף של עבודות בעיר מקונסולת האחמ"ש (בקשת יואב 26.08) -
 * אותה רשימה מנוהלת של הדוח היומי (report_projects): מה שנשמר כאן
 * מופיע מיד על מסך המוקד ונגרר אוטומטית לדוחות לפי טווח התאריכים.
 */
const pad = (n) => String(n).padStart(2, '0');
const ilDate = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};

const toRow = (p) => ({
  id: p.id,
  description: p.description || '',
  owner: p.owner || '',
  start: ilDate(p.start_date),
  end: p.end_date ? ilDate(p.end_date) : p.end_date_approx || '',
  overdue: p.end_date ? new Date(`${p.end_date}T23:59:59`) < new Date() : false,
});

export default function CityWorksManager() {
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch('/api/daily-report/projects', { credentials: 'include' });
      const body = await res.json();
      if (body.success) setWorks(body.data.map(toRow));
    } catch (error) {
      console.error('Error loading city works:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const update = (i, field, value) =>
    setWorks((prev) => prev.map((w, idx) => (idx === i ? { ...w, [field]: value, dirty: true } : w)));

  const save = async (i) => {
    const w = works[i];
    if (!w.description?.trim()) { toast.error('תיאור העבודה ריק'); return; }
    try {
      const isNew = !w.id;
      const res = await fetch('/api/daily-report/projects', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...(isNew ? {} : { id: w.id }),
          description: w.description,
          owner: w.owner,
          start: w.start,
          end: w.end,
        }),
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error || 'השמירה נכשלה');
      toast.success(isNew ? 'העבודה נוספה - מופיעה על המסך ובדוחות' : 'העבודה עודכנה');
      await load();
    } catch (error) {
      toast.error('שגיאה: ' + error.message);
    }
  };

  const end = async (i) => {
    const w = works[i];
    if (!w.id) { setWorks((prev) => prev.filter((_, idx) => idx !== i)); return; }
    if (!window.confirm('לסמן שהעבודה הסתיימה? היא תרד מהמסך ומהדוחות הבאים.')) return;
    try {
      const res = await fetch('/api/daily-report/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: w.id, status: 'ended' }),
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error || 'העדכון נכשל');
      toast.success('העבודה סומנה כהסתיימה');
      await load();
    } catch (error) {
      toast.error('שגיאה: ' + error.message);
    }
  };

  if (loading) return <p className="text-sm text-gray-500">טוען את רשימת העבודות...</p>;

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        💾 שינוי כאן מתעדכן מיד על מסך המוקד ונגרר אוטומטית לדוחות היומיים לפי התאריכים.
      </p>
      {works.map((w, i) => (
        <div key={w.id || `new-${i}`}
          className={`rounded-lg border-2 p-2 mb-2 ${w.overdue ? 'border-orange-300 bg-orange-50/60' : w.id ? 'border-gray-100' : 'border-blue-200 bg-blue-50/40'}`}>
          {w.overdue && (
            <p className="text-xs font-bold text-orange-700 mb-1">⏰ תאריך הסיום ({w.end}) עבר - סמן "הסתיימה" או עדכן ושמור.</p>
          )}
          {!w.id && <p className="text-xs font-bold text-blue-700 mb-1">עבודה חדשה - עוד לא נשמרה</p>}
          <div className="flex gap-2 items-start flex-wrap">
            <textarea value={w.description} onChange={(e) => update(i, 'description', e.target.value)}
              rows={2} placeholder="תיאור העבודה" className="flex-1 min-w-[240px] px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
            <input value={w.start} onChange={(e) => update(i, 'start', e.target.value)}
              placeholder="התחלה (20.08.2026)" className="w-32 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
            <input value={w.end} onChange={(e) => update(i, 'end', e.target.value)}
              placeholder="צפי סיום / ספטמבר" className="w-32 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
            <input value={w.owner} onChange={(e) => update(i, 'owner', e.target.value)}
              placeholder="אחריות" className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
            {(w.dirty || !w.id) && (
              <button onClick={() => save(i)}
                className="px-2 py-1 rounded bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">💾 שמור</button>
            )}
            <button onClick={() => end(i)}
              className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-sm font-bold hover:bg-red-100 hover:text-red-700">
              {w.id ? '✔ הסתיימה' : '✕'}
            </button>
          </div>
        </div>
      ))}
      <button onClick={() => setWorks((p) => [...p, { id: null, description: '', owner: '', start: '', end: '' }])}
        className="text-sm text-emerald-700 font-semibold hover:underline">➕ עבודה חדשה</button>
    </div>
  );
}
