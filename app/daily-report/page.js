'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { parseTicketsCsv, prepareTickets } from '@/lib/binaa-tickets';
import { buildReportWorkbook } from '@/lib/daily-report-excel';

/**
 * דוח הסיכום היומי (YOA-42, docs/16) - שלב 1: העלאת ייצוא הפניות מבינה,
 * סימון ידני של אירועים חריגים, מילוי המספרים, והפקת Excel בפורמט הקיים.
 * מקטעי האירועים והעבודות מאוכלסים מהדוח הקודם - סוף עידן ההעתק-מחק.
 */

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const AGAF_ORDER = ['שפ"ע', 'בטחון', 'חינוך', 'הנדסה'];
const AGAF_FIELDS = [
  ['opened', 'קריאות שנפתחו'],
  ['handled', 'קריאות שטופלו'],
  ['open_total', 'סך הקריאות הפתוחות'],
  ['overdue', 'חורגות מתוך הפתוחות'],
];

const pad = (n) => String(n).padStart(2, '0');
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ilDate = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;

// תווית התאריך כמו בדוחות הידניים: יום חול בשמו, ראשון = "יום סופ"ש"
function reportDateLabel(reportDate) {
  if (reportDate.getDay() === 0) {
    const friday = new Date(reportDate);
    friday.setDate(friday.getDate() - 2);
    return `יום סופ"ש ${pad(friday.getDate())}-${pad(reportDate.getDate())}.${pad(reportDate.getMonth() + 1)}.${reportDate.getFullYear()}`;
  }
  return `יום ${DAY_NAMES[reportDate.getDay()]} ${ilDate(reportDate)}`;
}

const emptyAgaf = () =>
  Object.fromEntries(AGAF_ORDER.map((name) => [name, { opened: '', handled: '', open_total: '', overdue: '' }]));

export default function DailyReportPage() {
  const router = useRouter();
  const fileRef = useRef(null);
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // מצב הטיוטה
  const [reportDate, setReportDate] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [fileName, setFileName] = useState('');
  const [search, setSearch] = useState('');
  const [agaf, setAgaf] = useState(emptyAgaf());
  const [cameras, setCameras] = useState({ ok: '', broken: '' });
  const [exceptional, setExceptional] = useState([]);
  const [cityEvents, setCityEvents] = useState([]);
  const [works, setWorks] = useState([]);
  const [producing, setProducing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [meRes, histRes] = await Promise.all([
        fetch('/api/auth/me', { credentials: 'include' }),
        fetch('/api/daily-report', { credentials: 'include' }),
      ]);
      if (!meRes.ok) return router.push('/login');
      setUser((await meRes.json()).user);
      if (histRes.ok) setHistory((await histRes.json()).data || []);
    } catch (error) {
      console.error('Error loading daily-report page:', error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const lastReport = history[0] || null;
  const previousSameDay = reportDate
    ? history.find((r) => r.report_date === dateStr(reportDate))
    : null;
  const previousTicketIds = new Set(previousSameDay?.snapshot?.ticket_ids || []);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const all = parseTicketsCsv(text);
      if (all.length === 0) {
        toast.error('לא זוהו פניות בקובץ - ודא שזה ייצוא הפניות מבינה');
        return;
      }
      // תאריך הדוח = היום המאוחר ביותר בקובץ
      const latest = all.reduce((m, t) => (t.openedAt > m ? t.openedAt : m), all[0].openedAt);
      const rDate = new Date(latest.getFullYear(), latest.getMonth(), latest.getDate());
      const { tickets: prepared } = prepareTickets(all, rDate);
      if (prepared.length === 0) {
        toast.error('אין פניות בחלון הזמן של הדוח');
        return;
      }
      setReportDate(rDate);
      setTickets(prepared);
      setFileName(file.name);
      setExceptional([]);
      setSearch('');
      // אכלוס מהדוח האחרון: אירועים ועבודות נגררים, מספרי האגפים רק לייחוס
      setCityEvents((lastReport?.snapshot?.city_events || []).map((ev) => ({ ...ev })));
      setWorks((lastReport?.snapshot?.works || []).map((w) => ({ ...w })));
      setAgaf(emptyAgaf());
      setCameras({
        ok: lastReport?.snapshot?.cameras?.ok ?? '',
        broken: lastReport?.snapshot?.cameras?.broken ?? '',
      });
    } catch (error) {
      console.error('CSV parse error:', error);
      toast.error('שגיאה בקריאת הקובץ: ' + error.message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const addToReport = (t) => {
    if (exceptional.some((e) => e.ticket_id === t.id)) return;
    setExceptional((prev) => [
      ...prev,
      {
        ticket_id: t.id,
        time_label: `${pad(t.openedAt.getDate())}.${pad(t.openedAt.getMonth() + 1)} ${pad(t.openedAt.getHours())}:${pad(t.openedAt.getMinutes())}`,
        description: `מספר פנייה: ${t.id}\nמיקום: ${t.address}\nתיאור הפנייה: ${t.description}`,
        treatment: `טיפול בפנייה: ${t.lastTreatment || ''}`,
        handler: t.handler || '',
      },
    ]);
  };

  const updateExceptional = (i, field, value) =>
    setExceptional((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)));

  const updateRow = (setter) => (i, field, value) =>
    setter((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  const removeRow = (setter) => (i) => setter((prev) => prev.filter((_, idx) => idx !== i));

  const produce = async () => {
    if (!reportDate) return;
    setProducing(true);
    try {
      const snapshot = {
        agaf: Object.fromEntries(
          AGAF_ORDER.map((name) => [
            name,
            Object.fromEntries(
              AGAF_FIELDS.map(([f]) => [f, agaf[name][f] === '' ? '' : Number(agaf[name][f])])
            ),
          ])
        ),
        cameras: {
          ok: cameras.ok === '' ? '' : Number(cameras.ok),
          broken: cameras.broken === '' ? '' : Number(cameras.broken),
        },
        exceptional,
        city_events: cityEvents.filter((ev) => ev.name?.trim()),
        works: works.filter((w) => w.description?.trim()),
        ticket_ids: tickets.map((t) => t.id),
        writer_name: user?.full_name || '',
      };
      const res = await fetch('/api/daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          report_date: dateStr(reportDate),
          source_file_name: fileName,
          snapshot,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'השמירה נכשלה');

      const wb = buildReportWorkbook(snapshot, reportDateLabel(reportDate));
      XLSX.writeFile(wb, `דוח סיכום יומי ${ilDate(reportDate)}.xlsx`);

      toast.success('הדוח הופק ונשמר בהיסטוריה');
      setReportDate(null);
      setTickets([]);
      await load();
    } catch (error) {
      toast.error('שגיאה בהפקה: ' + error.message);
    } finally {
      setProducing(false);
    }
  };

  const downloadFromHistory = (report) => {
    const d = new Date(`${report.report_date}T00:00:00`);
    const wb = buildReportWorkbook(report.snapshot, reportDateLabel(d));
    XLSX.writeFile(wb, `דוח סיכום יומי ${ilDate(d)}.xlsx`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <p className="text-gray-600">טוען...</p>
      </div>
    );
  }

  const visibleTickets = tickets.filter(
    (t) =>
      !t.groupedInto &&
      (!search.trim() ||
        `${t.id} ${t.address} ${t.department} ${t.subject} ${t.description}`.includes(search.trim()))
  );

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Toaster position="top-center" />
      <header className="bg-gradient-to-l from-emerald-800 to-slate-900 text-white shadow-xl">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">📄 דוח סיכום יומי</h1>
            <p className="text-sm opacity-80">{user?.full_name}</p>
          </div>
          <button
            onClick={() => router.push('/shift')}
            className="px-3 py-2 rounded-lg text-sm font-bold bg-white/10 hover:bg-white/20 border-2 border-white/20"
          >
            → ניהול משמרת
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {!reportDate ? (
          <>
            {/* העלאה */}
            <section className="bg-white rounded-xl shadow p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-2">העלאת ייצוא פניות מבינה</h2>
              <p className="text-sm text-gray-600 mb-4">
                ייצא מבינה את פניות היום (CSV) וגרור לכאן. המערכת תזהה את תאריך הדוח לבד -
                ביום ראשון הדוח יכסה גם את שישי ושבת.
              </p>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" id="report-upload" />
              <label
                htmlFor="report-upload"
                className="block border-2 border-dashed border-emerald-300 rounded-xl p-10 text-center bg-emerald-50/50 cursor-pointer hover:bg-emerald-50 transition-colors"
              >
                <div className="text-4xl mb-2">🗂️</div>
                <span className="font-semibold text-emerald-800">בחר או גרור קובץ CSV</span>
              </label>
            </section>

            {/* היסטוריה */}
            <section className="bg-white rounded-xl shadow p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-3">דוחות שהופקו</h2>
              {history.length === 0 ? (
                <p className="text-sm text-gray-500">עוד לא הופקו דוחות מהמערכת.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {history.map((r) => (
                    <li key={r.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-gray-900">
                        {reportDateLabel(new Date(`${r.report_date}T00:00:00`))}
                      </span>
                      <span className="text-gray-500">
                        הופק {new Date(r.produced_at).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {r.produced_by_name ? ` · ${r.produced_by_name}` : ''}
                      </span>
                      <button
                        onClick={() => downloadFromHistory(r)}
                        className="px-3 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-semibold hover:bg-emerald-200"
                      >
                        ⬇️ Excel
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : (
          <>
            {/* כותרת טיוטה */}
            <section className="bg-white rounded-xl shadow p-5 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  טיוטה: דוח סיכום יומי {reportDateLabel(reportDate)}
                </h2>
                <p className="text-sm text-gray-600">
                  {tickets.length} פניות בחלון הדוח · מתוך {fileName}
                </p>
                {previousSameDay && (
                  <p className="text-sm mt-1 text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1">
                    ⚠️ כבר הופק דוח לתאריך זה ב-
                    {new Date(previousSameDay.produced_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    {previousSameDay.produced_by_name ? ` ע"י ${previousSameDay.produced_by_name}` : ''} —
                    הפקה חדשה תתווסף להיסטוריה. פניות חדשות מסומנות למטה.
                  </p>
                )}
              </div>
              <button onClick={() => setReportDate(null)} className="px-3 py-2 rounded-lg text-sm bg-gray-200 hover:bg-gray-300 text-gray-800">
                ביטול
              </button>
            </section>

            {/* 1. אגפים */}
            <section className="bg-white rounded-xl shadow p-5">
              <h3 className="font-bold text-gray-900 mb-1">טבלת אגפים</h3>
              <p className="text-xs text-gray-500 mb-3">
                המספרים נלקחים מהסינון בבינה. {lastReport ? 'באפור - הערכים מהדוח הקודם.' : ''}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-right text-gray-600">
                      <th className="py-1 pl-3">אגף</th>
                      {AGAF_FIELDS.map(([f, label]) => (
                        <th key={f} className="py-1 px-2 font-semibold">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {AGAF_ORDER.map((name) => (
                      <tr key={name} className="border-t border-gray-100">
                        <td className="py-2 pl-3 font-bold text-gray-900">{name}</td>
                        {AGAF_FIELDS.map(([f]) => (
                          <td key={f} className="py-1 px-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={agaf[name][f]}
                                onChange={(e) =>
                                  setAgaf((prev) => ({ ...prev, [name]: { ...prev[name], [f]: e.target.value } }))
                                }
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-gray-900"
                              />
                              {lastReport?.snapshot?.agaf?.[name]?.[f] !== undefined &&
                                lastReport.snapshot.agaf[name][f] !== '' && (
                                  <span className="text-xs text-gray-400">{lastReport.snapshot.agaf[name][f]}</span>
                                )}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100">
                <span className="font-bold text-gray-900 text-sm">תקינות מצלמות:</span>
                <label className="text-sm text-gray-700 flex items-center gap-1">
                  תקין
                  <input type="number" value={cameras.ok} onChange={(e) => setCameras((p) => ({ ...p, ok: e.target.value }))}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-gray-900" />
                </label>
                <label className="text-sm text-gray-700 flex items-center gap-1">
                  לא תקין
                  <input type="number" value={cameras.broken} onChange={(e) => setCameras((p) => ({ ...p, broken: e.target.value }))}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-gray-900" />
                </label>
              </div>
            </section>

            {/* 2. אירועים חריגים */}
            <section className="bg-white rounded-xl shadow p-5">
              <h3 className="font-bold text-gray-900 mb-3">אירועים חריגים ({exceptional.length} בדוח)</h3>

              {exceptional.map((e, i) => (
                <div key={e.ticket_id} className="border-2 border-emerald-200 bg-emerald-50/40 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-emerald-800">{e.time_label} · פנייה {e.ticket_id}</span>
                    <button onClick={() => setExceptional((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-red-500 font-bold text-sm hover:text-red-700">✕ הסר</button>
                  </div>
                  <textarea value={e.description} onChange={(ev) => updateExceptional(i, 'description', ev.target.value)}
                    rows={3} className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 mb-2" />
                  <div className="flex gap-2 flex-wrap">
                    <input value={e.treatment} onChange={(ev) => updateExceptional(i, 'treatment', ev.target.value)}
                      placeholder="דרך טיפול" className="flex-1 min-w-[200px] px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
                    <input value={e.handler} onChange={(ev) => updateExceptional(i, 'handler', ev.target.value)}
                      placeholder="גורם מטפל" className="w-40 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
                  </div>
                </div>
              ))}

              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-sm font-bold text-gray-700">כל פניות היום — בחר מה נכנס לדוח:</h4>
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש..."
                    className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
                  {visibleTickets.map((t) => {
                    const inReport = exceptional.some((e) => e.ticket_id === t.id);
                    const isNew = previousSameDay && !previousTicketIds.has(t.id);
                    return (
                      <div key={t.id} className={`p-2 flex items-start gap-2 text-sm ${inReport ? 'bg-emerald-50' : ''}`}>
                        <button onClick={() => addToReport(t)} disabled={inReport}
                          className={`shrink-0 px-2 py-1 rounded text-xs font-bold ${inReport ? 'bg-emerald-200 text-emerald-800' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'}`}>
                          {inReport ? '✓ בדוח' : '➕ לדוח'}
                        </button>
                        <div className="min-w-0">
                          <div className="text-xs text-gray-500">
                            {pad(t.openedAt.getHours())}:{pad(t.openedAt.getMinutes())} · {t.department}
                            {t.linkedDepartments?.length ? ` (+${t.linkedDepartments.join(', ')})` : ''} · {t.address}
                            {t.groupCount > 1 && <span className="text-purple-600 font-bold"> · {t.groupCount} פניות</span>}
                            {isNew && <span className="mr-1 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-bold">חדש מאז ההפקה הקודמת</span>}
                          </div>
                          <div className="text-gray-900 truncate">{t.description}</div>
                        </div>
                      </div>
                    );
                  })}
                  {visibleTickets.length === 0 && (
                    <p className="p-3 text-sm text-gray-500">אין פניות תואמות.</p>
                  )}
                </div>
              </div>
            </section>

            {/* 3. אירועים בעיר */}
            <section className="bg-white rounded-xl shadow p-5">
              <h3 className="font-bold text-gray-900 mb-1">אירועים בעיר</h3>
              <p className="text-xs text-gray-500 mb-3">מאוכלס מהדוח הקודם - עדכן לפי היום.</p>
              {cityEvents.map((ev, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input value={ev.name || ''} onChange={(e) => updateRow(setCityEvents)(i, 'name', e.target.value)}
                    placeholder="שם האירוע" className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
                  <input value={ev.date || ''} onChange={(e) => updateRow(setCityEvents)(i, 'date', e.target.value)}
                    placeholder="תאריך" className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
                  <input value={ev.hour || ''} onChange={(e) => updateRow(setCityEvents)(i, 'hour', e.target.value)}
                    placeholder="שעה" className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
                  <button onClick={() => removeRow(setCityEvents)(i)} className="text-red-500 font-bold px-1">✕</button>
                </div>
              ))}
              <button onClick={() => setCityEvents((p) => [...p, { name: '', date: ilDate(reportDate), hour: '' }])}
                className="text-sm text-emerald-700 font-semibold hover:underline">➕ אירוע</button>
            </section>

            {/* 4. עבודות בעיר */}
            <section className="bg-white rounded-xl shadow p-5">
              <h3 className="font-bold text-gray-900 mb-1">עבודות בעיר</h3>
              <p className="text-xs text-gray-500 mb-3">מאוכלס מהדוח הקודם - מחק מה שהסתיים, הוסף מה שחדש.</p>
              {works.map((w, i) => (
                <div key={i} className="flex gap-2 mb-2 items-start">
                  <textarea value={w.description || ''} onChange={(e) => updateRow(setWorks)(i, 'description', e.target.value)}
                    rows={2} placeholder="תיאור העבודה" className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
                  <input value={w.start || ''} onChange={(e) => updateRow(setWorks)(i, 'start', e.target.value)}
                    placeholder="התחלה" className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
                  <input value={w.end || ''} onChange={(e) => updateRow(setWorks)(i, 'end', e.target.value)}
                    placeholder="צפי סיום" className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
                  <input value={w.owner || ''} onChange={(e) => updateRow(setWorks)(i, 'owner', e.target.value)}
                    placeholder="אחריות" className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
                  <button onClick={() => removeRow(setWorks)(i)} className="text-red-500 font-bold px-1">✕</button>
                </div>
              ))}
              <button onClick={() => setWorks((p) => [...p, { description: '', start: '', end: '', owner: '' }])}
                className="text-sm text-emerald-700 font-semibold hover:underline">➕ עבודה</button>
            </section>

            {/* הפקה */}
            <section className="bg-white rounded-xl shadow p-5 flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm text-gray-600">
                ההפקה שומרת את הדוח בהיסטוריה ומורידה Excel בפורמט המוכר. שליחה למירי ולרשימה - כמו היום.
              </p>
              <button onClick={produce} disabled={producing}
                className="px-6 py-2 rounded-lg font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300">
                {producing ? '⏳ מפיק...' : '📄 הפק דוח'}
              </button>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
