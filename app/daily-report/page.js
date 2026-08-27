'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { parseTicketsCsv, prepareTickets, detectExportKind, computeAgafTable } from '@/lib/binaa-tickets';
import { projectRowsForReport, ilToIso, isoToIl, todayIl } from '@/lib/daily-report-city';
import { downloadStyledExcel } from '@/lib/daily-report-excel';
import { downloadPdf } from '@/lib/daily-report-print';

/**
 * דוח הסיכום היומי (YOA-42, docs/16): שני ייצואים מבינה - קובץ היום
 * (נפתחו/טופלו) וקובץ הפתוחות (סך פתוחות/חורגות) - ממלאים את טבלת
 * האגפים אוטומטית. חריגים מנוסחים מעדכוני ה-WhatsApp, Excel מעוצב
 * בפורמט הידני, ו-PDF יורד כקובץ מוכן לשליחה.
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
  const [dayAll, setDayAll] = useState([]); // הפרסינג הגולמי - לספירת האגפים (כולל פניות-בנות)
  const [openInfo, setOpenInfo] = useState(null); // { tickets, name } של קובץ הפתוחות
  const [fileName, setFileName] = useState('');
  const [search, setSearch] = useState('');
  const [agaf, setAgaf] = useState(emptyAgaf());
  const [cameras, setCameras] = useState({ ok: '', broken: '' });
  const [exceptional, setExceptional] = useState([]);
  const [cityEvents, setCityEvents] = useState([]);
  const [eventsSource, setEventsSource] = useState(''); // 'site' | 'previous' | ''
  const [works, setWorks] = useState([]);
  const [producing, setProducing] = useState(false);
  // כותב/ת הדוח משתנה ממשמרת למשמרת (לפעמים שני שמות) - שדה חופשי
  // שמתחיל מהמשתמש המחובר; "מאשרת את הדוח: מירי צרפתי" קבוע בתבנית.
  const [writerName, setWriterName] = useState('');
  // ניסוח ה-WhatsApp (החלטת יואב 26.08: זה מקור האירועים החריגים,
  // לא סיווג אוטומטי של פניות בינה): idle | running | done | failed
  const [aiStatus, setAiStatus] = useState('idle');
  const [waText, setWaText] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesText, setRulesText] = useState('');

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

  // טבלת האגפים של computeAgafTable → ערכי המחרוזת של שדות הקלט
  const agafToInputs = (table) =>
    Object.fromEntries(
      AGAF_ORDER.map((name) => [
        name,
        Object.fromEntries(AGAF_FIELDS.map(([f]) => [f, table[name][f] === '' ? '' : String(table[name][f])])),
      ])
    );

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    // הקבצים מסווגים לבד: קובץ יום (סטטוסים מעורבים, יום אחד) מול
    // קובץ פתוחות (הכול פתוח, תאריכים מכל התקופה)
    let nextDayAll = dayAll;
    let nextOpen = openInfo;
    let nextDate = reportDate;
    let dayFileArrived = false;
    try {
      for (const file of files) {
        const all = parseTicketsCsv(await file.text());
        if (all.length === 0) {
          toast.error(`${file.name}: לא זוהו פניות - ודא שזה ייצוא מבינה`);
          continue;
        }
        if (detectExportKind(all) === 'open') {
          nextOpen = { tickets: all, name: file.name };
          toast.success(`${file.name}: זוהה כקובץ הפניות הפתוחות (${all.length} פניות)`);
        } else {
          const latest = all.reduce((m, t) => (t.openedAt > m ? t.openedAt : m), all[0].openedAt);
          nextDate = new Date(latest.getFullYear(), latest.getMonth(), latest.getDate());
          nextDayAll = all;
          dayFileArrived = true;
          setFileName(file.name);
          toast.success(`${file.name}: זוהה כקובץ פניות היום`);
        }
      }

      if (dayFileArrived) {
        const { tickets: prepared } = prepareTickets(nextDayAll, nextDate);
        if (prepared.length === 0) {
          toast.error('אין פניות בחלון הזמן של הדוח');
          return;
        }
        setReportDate(nextDate);
        setTickets(prepared);
        setDayAll(nextDayAll);
        setExceptional([]);
        setSearch('');
        setCameras({
          ok: lastReport?.snapshot?.cameras?.ok ?? '',
          broken: lastReport?.snapshot?.cameras?.broken ?? '',
        });
        setWriterName(user?.full_name || '');
        // המקורות האוטומטיים - במקביל, בלי לעכב את הטיוטה
        loadCityEvents(nextDate);
        loadWorks(nextDate);
      }
      if (nextOpen !== openInfo) setOpenInfo(nextOpen);

      // טבלת האגפים מחושבת מכל מה שהועלה עד עכשיו; אפשר לתקן ידנית
      if ((dayFileArrived || nextOpen !== openInfo) && (nextDate || reportDate)) {
        const table = computeAgafTable(
          nextDayAll.length ? nextDayAll : null,
          nextOpen?.tickets || null,
          nextDate || reportDate
        );
        setAgaf(agafToInputs(table));
      }
    } catch (error) {
      console.error('CSV parse error:', error);
      toast.error('שגיאה בקריאת הקובץ: ' + error.message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // אירועים בעיר: קודם אתר העירייה; אם אין - נגרר מהדוח הקודם לעריכה
  const loadCityEvents = async (rDate) => {
    try {
      const res = await fetch(`/api/daily-report/city-events?date=${dateStr(rDate)}`, { credentials: 'include' });
      const body = await res.json();
      if (res.ok && body.data?.length) {
        setCityEvents(body.data);
        setEventsSource('site');
        return;
      }
      if (body.warning) toast(body.warning, { icon: '⚠️' });
    } catch {
      toast('אתר העירייה לא זמין - האירועים נגררו מהדוח הקודם', { icon: '⚠️' });
    }
    setCityEvents((lastReport?.snapshot?.city_events || []).map((ev) => ({ ...ev })));
    setEventsSource('previous');
  };

  // עבודות בעיר: הרשימה המנוהלת, מסוננת לפי טווחי התאריכים
  const loadWorks = async (rDate) => {
    try {
      const res = await fetch('/api/daily-report/projects', { credentials: 'include' });
      const body = await res.json();
      if (res.ok && body.success) {
        setWorks(projectRowsForReport(body.data, rDate));
        return;
      }
      throw new Error(body.error);
    } catch {
      toast('רשימת העבודות לא נטענה - נגררה מהדוח הקודם', { icon: '⚠️' });
      setWorks((lastReport?.snapshot?.works || []).map((w) => ({ ...w })));
    }
  };

  const patchWork = async (row, changes, onDone) => {
    try {
      const res = await fetch('/api/daily-report/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: row.id, ...changes }),
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error);
      onDone?.();
    } catch (error) {
      toast.error('שמירת העבודה נכשלה: ' + error.message);
    }
  };

  const saveWorkRow = async (i) => {
    const row = works[i];
    if (!row.description?.trim()) { toast.error('תיאור העבודה ריק'); return; }
    if (row.isNew) {
      try {
        const res = await fetch('/api/daily-report/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ description: row.description, owner: row.owner, start: row.start, end: row.end }),
        });
        const body = await res.json();
        if (!body.success) throw new Error(body.error);
        setWorks((prev) => prev.map((w, idx) =>
          idx === i ? { ...projectRowsForReport([body.data], reportDate)[0] || w, dirty: false } : w
        ));
        toast.success('העבודה נשמרה - תיגרר אוטומטית לדוחות הבאים');
      } catch (error) {
        toast.error('שמירת העבודה נכשלה: ' + error.message);
      }
      return;
    }
    await patchWork(row, { description: row.description, owner: row.owner, start: row.start, end: row.end }, () => {
      setWorks((prev) => prev.map((w, idx) => (idx === i ? { ...w, dirty: false } : w)));
      toast.success('העבודה עודכנה');
    });
  };

  const endWork = async (i) => {
    const row = works[i];
    if (row.isNew || !row.id) { setWorks((prev) => prev.filter((_, idx) => idx !== i)); return; }
    await patchWork(row, { status: 'ended' }, () => {
      setWorks((prev) => prev.filter((_, idx) => idx !== i));
      toast.success('העבודה סומנה כהסתיימה ולא תופיע יותר');
    });
  };

  const updateWork = (i, field, value) =>
    setWorks((prev) => prev.map((w, idx) => (idx === i ? { ...w, [field]: value, dirty: true } : w)));

  const draftEntry = (t) => ({
    ticket_id: t.id,
    time_label: `${pad(t.openedAt.getDate())}.${pad(t.openedAt.getMonth() + 1)} ${pad(t.openedAt.getHours())}:${pad(t.openedAt.getMinutes())}`,
    description: `מספר פנייה: ${t.id}\nמיקום: ${t.address}\nתיאור הפנייה: ${t.description}`,
    treatment: `טיפול בפנייה: ${t.lastTreatment && t.lastTreatment.trim() !== '-' ? t.lastTreatment.trim() : ''}`,
    handler: t.handler || '',
  });

  const addToReport = (t) => {
    if (exceptional.some((e) => e.ticket_id === t.id)) return;
    setExceptional((prev) => [...prev, draftEntry(t)]);
  };

  // שלב 2 (docs/16): קריאה אחת עם כל פניות היום, נטולות PII כבר כאן.
  // סכנה וחשוב-לידיעה נכנסים לטיוטה אוטומטית - סכנות תחילה; ה-AI
  // אינו תנאי - כשל משאיר את הסימון הידני בדיוק כמו קודם.
  // עדכוני ה-WhatsApp (הקבוצה + ההודעות למנכ"ל) הם מקור האירועים
  // החריגים: ה-AI מפרק, מנסח מקצועי-קצר-מדויק בפורמט הדוח, משתמש
  // בדרך הטיפול שכתובה בהודעה, ומצליב מספר פנייה מהקובץ כשאפשר.
  const parseWhatsapp = async () => {
    if (!waText.trim()) { toast.error('הדבק קודם את הודעות ה-WhatsApp'); return; }
    setAiStatus('running');
    try {
      const payload = tickets.map((t) => ({
        id: t.id,
        openedAt: t.openedAt?.toISOString(),
        department: t.department,
        subject: t.subject,
        description: t.description,
        address: t.address,
      }));
      const res = await fetch('/api/daily-report/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: waText, tickets: payload }),
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error || 'הניסוח נכשל');

      // הפורמט המלא של הדוח הידני: מספר פנייה / מיקום / תיאור, כל
      // אחד בשורה משלו (בקשת יואב 27.08). המיקום - מההודעה, ואם אין
      // אז מהפנייה התואמת בקובץ.
      const entries = body.data.map((ev, i) => {
        const matched = ev.ticket_id ? tickets.find((t) => t.id === ev.ticket_id) : null;
        const location = ev.location || matched?.address || '';
        const lines = [];
        if (ev.ticket_id) lines.push(`מספר פנייה: ${ev.ticket_id}`);
        if (location) lines.push(`מיקום: ${location}`);
        lines.push(`${ev.ticket_id ? 'תיאור הפנייה' : 'תיאור האירוע'}: ${ev.description}`);
        return {
          ticket_id: ev.ticket_id || `wa-${Date.now()}-${i}`,
          time_label: ev.time_label || '',
          description: lines.join('\n'),
          treatment: ev.treatment || '',
          handler: ev.handler || '',
          source: 'whatsapp',
        };
      });
      setExceptional((prev) => {
        const existing = new Set(prev.map((e) => e.ticket_id));
        return [...prev, ...entries.filter((e) => !existing.has(e.ticket_id))];
      });
      setAiStatus('done');
      setWaText('');
      toast.success(
        entries.length
          ? `🤖 נוסחו ${entries.length} אירועים מה-WhatsApp - עבור עליהם ואשר`
          : '🤖 לא זוהו אירועים בטקסט שהודבק'
      );
    } catch (error) {
      setAiStatus('failed');
      toast(`ה-AI לא זמין (${error.message}) - הוסף ידנית`, { icon: '⚠️' });
    }
  };

  const updateExceptional = (i, field, value) =>
    setExceptional((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)));

  const openRules = async () => {
    if (!rulesOpen && !rulesText) {
      try {
        const res = await fetch('/api/daily-report/classify', { credentials: 'include' });
        const body = await res.json();
        if (body.success) setRulesText(body.data.classification_rules);
      } catch { /* הטקסט יישאר ריק - עדיף מלחסום */ }
    }
    setRulesOpen((v) => !v);
  };

  const saveRules = async () => {
    try {
      const res = await fetch('/api/daily-report/classify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ classification_rules: rulesText }),
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error || 'השמירה נכשלה');
      toast.success('הכללים נשמרו - ייכנסו לתוקף בסיווג הבא');
      setRulesOpen(false);
    } catch (error) {
      toast.error('שמירת הכללים נכשלה: ' + error.message);
    }
  };

  const updateRow = (setter) => (i, field, value) =>
    setter((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  const removeRow = (setter) => (i) => setter((prev) => prev.filter((_, idx) => idx !== i));

  const buildSnapshot = () => ({
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
    works: works
      .filter((w) => w.description?.trim())
      .map(({ description, start, end, owner }) => ({ description, start, end, owner })),
    ticket_ids: tickets.map((t) => t.id),
    open_ticket_count: openInfo?.tickets.length ?? null,
    writer_name: writerName.trim() || user?.full_name || '',
  });

  const produce = async () => {
    if (!reportDate) return;
    setProducing(true);
    try {
      const snapshot = buildSnapshot();
      const res = await fetch('/api/daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          report_date: dateStr(reportDate),
          source_file_name: [fileName, openInfo?.name].filter(Boolean).join(' + '),
          snapshot,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'השמירה נכשלה');

      await downloadStyledExcel(
        snapshot,
        reportDateLabel(reportDate),
        `דוח סיכום יומי ${ilDate(reportDate)}.xlsx`
      );

      toast.success('הדוח הופק ונשמר בהיסטוריה');
      setReportDate(null);
      setTickets([]);
      setDayAll([]);
      setOpenInfo(null);
      setFileName('');
      setAiStatus('idle');
      setWaText('');
      await load();
    } catch (error) {
      toast.error('שגיאה בהפקה: ' + error.message);
    } finally {
      setProducing(false);
    }
  };

  // PDF יורד כקובץ אמיתי עם שם מסודר - לא דרך חלון הדפסה (בקשת יואב 26.08)
  const previewPdf = async () => {
    if (!reportDate) return;
    try {
      toast('מכין את ה-PDF...', { icon: '⏳' });
      await downloadPdf(buildSnapshot(), reportDateLabel(reportDate), `דוח סיכום יומי ${ilDate(reportDate)}.pdf`);
      toast.success('ה-PDF ירד למחשב');
    } catch (error) {
      toast.error('יצירת ה-PDF נכשלה: ' + error.message);
    }
  };

  const downloadFromHistory = async (report) => {
    const d = new Date(`${report.report_date}T00:00:00`);
    await downloadStyledExcel(report.snapshot, reportDateLabel(d), `דוח סיכום יומי ${ilDate(d)}.xlsx`);
  };

  const pdfFromHistory = async (report) => {
    const d = new Date(`${report.report_date}T00:00:00`);
    try {
      toast('מכין את ה-PDF...', { icon: '⏳' });
      await downloadPdf(report.snapshot, reportDateLabel(d), `דוח סיכום יומי ${ilDate(d)}.pdf`);
      toast.success('ה-PDF ירד למחשב');
    } catch (error) {
      toast.error('יצירת ה-PDF נכשלה: ' + error.message);
    }
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
        {/* ה-input חי מחוץ לתנאי כדי ש"העלה אותו" יעבוד גם מתוך הטיוטה */}
        <input ref={fileRef} type="file" accept=".csv" multiple onChange={handleFiles} className="hidden" id="report-upload" />
        {!reportDate ? (
          <>
            {/* העלאה */}
            <section className="bg-white rounded-xl shadow p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-2">העלאת ייצואי הפניות מבינה</h2>
              <p className="text-sm text-gray-600 mb-4">
                שני ייצואים (CSV): <b>פניות היום</b> (נפתחו/טופלו) ו<b>הפניות הפתוחות</b> (סך
                פתוחות/חורגות). אפשר לגרור את שניהם יחד - המערכת מזהה לבד איזה קובץ הוא מה,
                וביום ראשון הדוח יכסה גם את שישי ושבת.
              </p>
              <label
                htmlFor="report-upload"
                className="block border-2 border-dashed border-emerald-300 rounded-xl p-10 text-center bg-emerald-50/50 cursor-pointer hover:bg-emerald-50 transition-colors"
              >
                <div className="text-4xl mb-2">🗂️</div>
                <span className="font-semibold text-emerald-800">בחר או גרור את שני קובצי ה-CSV</span>
                <p className="text-xs text-emerald-700 mt-1">אפשר גם אחד-אחד - המערכת מזהה לבד</p>
              </label>
              <div className="grid sm:grid-cols-2 gap-3 mt-4 text-sm">
                <div className="rounded-lg border-2 border-gray-200 bg-gray-50 px-3 py-2">
                  <span className="font-bold text-gray-800">📅 פניות היום</span>
                  <span className="text-gray-500"> — לחישוב "נפתחו" ו"טופלו". </span>
                  <span className="text-gray-500">ההעלאה שלו פותחת את הטיוטה למילוי.</span>
                </div>
                <div className={`rounded-lg border-2 px-3 py-2 ${openInfo ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
                  <span className="font-bold text-gray-800">📂 פניות פתוחות</span>
                  {openInfo ? (
                    <span className="text-emerald-800"> — ✓ נטען ({openInfo.name}, {openInfo.tickets.length} פניות)</span>
                  ) : (
                    <span className="text-gray-500"> — לחישוב "סך פתוחות" ו"חורגות". טרם הועלה.</span>
                  )}
                </div>
              </div>
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
                      <span className="flex gap-2">
                        <button
                          onClick={() => downloadFromHistory(r)}
                          className="px-3 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-semibold hover:bg-emerald-200"
                        >
                          ⬇️ Excel
                        </button>
                        <button
                          onClick={() => pdfFromHistory(r)}
                          className="px-3 py-1 rounded-lg bg-blue-100 text-blue-800 font-semibold hover:bg-blue-200"
                        >
                          ⬇️ PDF
                        </button>
                      </span>
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
              <p className="text-xs text-gray-500 mb-1">
                חושב אוטומטית מהקבצים - אפשר לתקן ידנית. {lastReport ? 'באפור - הערכים מהדוח הקודם.' : ''}
              </p>
              {!openInfo ? (
                <p className="text-xs mb-3 text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1 inline-block">
                  ⚠️ קובץ הפניות הפתוחות לא הועלה - "סך פתוחות" ו"חורגות" ריקות.{' '}
                  <label htmlFor="report-upload" className="underline font-semibold cursor-pointer">העלה אותו</label>
                </p>
              ) : (
                <p className="text-xs mb-3 text-gray-500">
                  פתוחות מתוך {openInfo.name} ({openInfo.tickets.length} פניות) · חורגת = SLA של 100% ומעלה
                </p>
              )}
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
              <div className="mt-4 pt-3 border-t border-gray-100 rounded-lg bg-amber-50/60 border-2 border-amber-200 p-3">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="font-bold text-gray-900 text-sm">📷 תקינות מצלמות</span>
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
                  <span className="text-xs text-gray-500">מילוי ידני מהבדיקה היומית - נכנס לדוח אוטומטית (מתחיל מערכי הדוח הקודם)</span>
                </div>
              </div>
            </section>

            {/* 2. אירועים חריגים */}
            <section className="bg-white rounded-xl shadow p-5">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <h3 className="font-bold text-gray-900">אירועים חריגים ({exceptional.length} בדוח)</h3>
                <div className="flex items-center gap-2 text-xs">
                  {aiStatus === 'running' && <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 font-bold">🤖 מנסח את העדכונים...</span>}
                  {aiStatus === 'failed' && <span className="px-2 py-1 rounded bg-orange-50 text-orange-700 font-bold">⚠️ AI לא זמין - הוסף ידנית</span>}
                  <button onClick={openRules} className="px-2 py-1 rounded bg-gray-100 text-gray-700 font-bold hover:bg-gray-200">
                    ⚙️ הנחיות ל-AI
                  </button>
                </div>
              </div>

              {/* מקור האמת: עדכוני ה-WhatsApp של היום */}
              <div className="border-2 border-emerald-300 bg-emerald-50/50 rounded-lg p-3 mb-4">
                <p className="text-sm font-bold text-gray-900 mb-1">📋 עדכוני WhatsApp של היום</p>
                <p className="text-xs text-gray-600 mb-2">
                  העתק מהקבוצה או מההודעות למנכ"ל והדבק כאן - ה-AI ינסח כל אירוע לדוח בצורה
                  מקצועית וקצרה, עם דרך הטיפול מההודעה, ויצרף מספר פנייה אם קיים בקובץ.
                  ברוב הימים אין כלום - וזה בסדר, המקטע יישאר ריק.
                </p>
                <textarea value={waText} onChange={(e) => setWaText(e.target.value)} rows={4}
                  placeholder={'למשל:\n[13:05] שריפת קוצים מאחורי העצמאות, כיבוי אש במקום...'}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 mb-2" />
                <button onClick={parseWhatsapp} disabled={aiStatus === 'running'}
                  className="px-4 py-1.5 rounded bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:bg-gray-300">
                  {aiStatus === 'running' ? '⏳ מנסח...' : '🤖 נסח לדוח'}
                </button>
              </div>

              {rulesOpen && (
                <div className="border-2 border-gray-200 rounded-lg p-3 mb-3 bg-gray-50">
                  <p className="text-xs text-gray-600 mb-2">
                    הנחיות בעברית חופשית שה-AI מקבל בכל ניסוח - מה נחשב אירוע לדוח, סגנון, מה לדלג.
                  </p>
                  <textarea value={rulesText} onChange={(e) => setRulesText(e.target.value)} rows={6}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 mb-2" />
                  <div className="flex gap-2">
                    <button onClick={saveRules} className="px-3 py-1 rounded bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">💾 שמור כללים</button>
                    <button onClick={() => setRulesOpen(false)} className="px-3 py-1 rounded bg-gray-200 text-gray-700 text-sm font-bold">סגור</button>
                  </div>
                </div>
              )}

              {exceptional.map((e, i) => (
                <div key={e.ticket_id} className="border-2 border-emerald-200 bg-emerald-50/40 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                    <span className="text-xs font-bold text-emerald-800">
                      {e.time_label}
                      {!String(e.ticket_id).startsWith('wa-') && <> · פנייה {e.ticket_id}</>}
                      {e.source === 'whatsapp' && <span className="mr-2 px-1.5 py-0.5 rounded bg-green-100 text-green-800">📋 מה-WhatsApp</span>}
                    </span>
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
              <p className="text-xs mb-3">
                {eventsSource === 'site' ? (
                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
                    🌐 נמשך אוטומטית מאתר העירייה ({cityEvents.length} אירועים ליום הדוח) - מחק מה שלא רלוונטי
                  </span>
                ) : (
                  <span className="text-gray-500">נגרר מהדוח הקודם - עדכן לפי היום.</span>
                )}
              </p>
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

            {/* 4. עבודות בעיר - רשימה מנוהלת שנשמרת קדימה */}
            <section className="bg-white rounded-xl shadow p-5">
              <h3 className="font-bold text-gray-900 mb-1">עבודות בעיר</h3>
              <p className="text-xs text-gray-500 mb-3">
                💾 רשימה קבועה שנשמרת במערכת ונגררת אוטומטית מדוח לדוח לפי טווח התאריכים.
                עבודה שהסתיימה - סמן "הסתיימה" והיא תיעלם מהדוחות הבאים.
              </p>
              {works.map((w, i) => (
                <div key={w.id || `new-${i}`}
                  className={`rounded-lg border-2 p-2 mb-2 ${w.isNew ? 'border-blue-200 bg-blue-50/40' : 'border-gray-100'}`}>
                  {w.isNew && <p className="text-xs font-bold text-blue-700 mb-1">עבודה חדשה - עוד לא נשמרה</p>}
                  <div className="flex gap-2 items-start flex-wrap">
                    <textarea value={w.description || ''} onChange={(e) => updateWork(i, 'description', e.target.value)}
                      rows={2} placeholder="תיאור העבודה" className="flex-1 min-w-[240px] px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
                    <label className="text-xs text-gray-500">
                      התחלה
                      <input type="date" value={ilToIso(w.start)} onChange={(e) => updateWork(i, 'start', isoToIl(e.target.value))}
                        className="block px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
                    </label>
                    <label className="text-xs text-gray-500">
                      צפי סיום
                      <input type="date" value={ilToIso(w.end)} onChange={(e) => updateWork(i, 'end', isoToIl(e.target.value))}
                        className="block px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
                      {!w.end || w.end === 'אין צפי לסיום' ? (
                        <span className="block text-gray-400 mt-0.5">אין צפי לסיום</span>
                      ) : !ilToIso(w.end) ? (
                        <span className="block text-amber-700 mt-0.5">📝 {w.end}</span>
                      ) : (
                        <button type="button" onClick={() => updateWork(i, 'end', '')}
                          className="block text-blue-600 hover:underline mt-0.5">↩︎ אין צפי לסיום</button>
                      )}
                    </label>
                    <input value={w.owner || ''} onChange={(e) => updateWork(i, 'owner', e.target.value)}
                      placeholder="אחריות" className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900" />
                    {(w.dirty || w.isNew) && (
                      <button onClick={() => saveWorkRow(i)}
                        className="px-2 py-1 rounded bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">💾 שמור</button>
                    )}
                    <button onClick={() => endWork(i)}
                      className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-sm font-bold hover:bg-red-100 hover:text-red-700">
                      {w.isNew ? '✕' : '✔ הסתיימה'}
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={() => setWorks((p) => [...p, { isNew: true, description: '', start: todayIl(), end: '', owner: '' }])}
                className="text-sm text-emerald-700 font-semibold hover:underline">➕ עבודה חדשה</button>
            </section>

            {/* חתימות והפקה */}
            <section className="bg-white rounded-xl shadow p-5 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  ✍️ כותב/ת הדוח:
                  <input value={writerName} onChange={(e) => setWriterName(e.target.value)}
                    placeholder="למשל: דנה אהרון - עפרי מדר"
                    className="w-64 px-2 py-1 border border-gray-300 rounded text-sm font-normal text-gray-900" />
                </label>
                <span className="text-sm text-gray-500">מאשרת את הדוח: מירי צרפתי (קבוע)</span>
              </div>
              <p className="text-sm text-gray-600 w-full">
                ההפקה שומרת את הדוח בהיסטוריה ומורידה Excel מעוצב בפורמט המוכר. כפתור PDF
                מוריד קובץ PDF מוכן לשליחה. שליחה למירי ולרשימה - כמו היום.
              </p>
              <div className="flex gap-2">
                <button onClick={previewPdf}
                  className="px-4 py-2 rounded-lg font-bold text-blue-800 bg-blue-100 hover:bg-blue-200">
                  ⬇️ PDF
                </button>
                <button onClick={produce} disabled={producing}
                  className="px-6 py-2 rounded-lg font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300">
                  {producing ? '⏳ מפיק...' : '📄 הפק דוח'}
                </button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
