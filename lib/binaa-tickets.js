/**
 * פענוח ייצוא הפניות מבינה 360 (YOA-42, docs/16).
 * הקובץ: CSV עם BOM, כל שדה במרכאות, שורת-שורה אפשרית בתוך שדה.
 */

const HEADER_MAP = {
  "מס' פניה": 'id',
  'תאריך ושעת פתיחה': 'openedAtRaw',
  'סטטוס פנייה': 'status',
  'שם הפונה': 'reporterName',
  'טלפון נייד': 'reporterPhone',
  'כתובת ואתר/מוסד': 'address',
  'מחלקה': 'department',
  'נושא': 'subject',
  'נושא משנה': 'subSubject',
  'תיאור': 'description',
  'גורם מטפל': 'handler',
  'שורת טיפול אחרונה': 'lastTreatment',
  // הפורמט מאוגוסט 2026: עמודת אגף מובנית ומדד SLA באחוזים
  'אגף': 'agafRaw',
  'מדד SLA לפני חריגה': 'slaRaw',
  'מדד SLA': 'slaRaw', // השם בפורמט הישן - fallback בלבד
};

// "אגף שפ"ע" בקובץ → "שפ"ע" בדוח; שאר האגפים מגיעים בלי קידומת
function normalizeAgaf(raw) {
  return (raw || '').replace(/^אגף\s+/, '').trim();
}

function parseSlaPct(raw) {
  const m = (raw || '').trim().match(/^([\d.]+)%$/);
  return m ? Number(m[1]) : null;
}

function splitCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(f => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.some(f => f.trim() !== '')) rows.push(row);
  }
  return rows;
}

function parseIsraeliDateTime(raw) {
  const m = raw?.trim().match(/^(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;
  return new Date(2000 + Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]));
}

export function parseTicketsCsv(text) {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = splitCsv(clean);
  if (rows.length < 2) return [];
  const header = rows[0].map(h => h.trim());
  const idx = {};
  for (const [hebrew, key] of Object.entries(HEADER_MAP)) {
    const i = header.indexOf(hebrew);
    // שם עמודה יכול להופיע בכמה גרסאות (ישן/חדש) - הראשון שנמצא מנצח
    if (idx[key] === undefined || (idx[key] < 0 && i >= 0)) idx[key] = i;
  }
  return rows.slice(1).map(cells => {
    const get = (key) => (idx[key] >= 0 ? (cells[idx[key]] || '').trim() : '');
    const rawId = get('id');
    // סיומת "-X" = פנייה-בת שפוצלה למחלקה נוספת; האם היא החלק שלפני המקף
    const childMatch = rawId.match(/^(\d+)-(.+)$/);
    return {
      id: rawId,
      parentId: childMatch ? childMatch[1] : null,
      openedAt: parseIsraeliDateTime(get('openedAtRaw')),
      status: get('status'),
      department: get('department'),
      subject: get('subject'),
      subSubject: get('subSubject'),
      description: get('description'),
      address: get('address'),
      handler: get('handler'),
      lastTreatment: get('lastTreatment'),
      reporterName: get('reporterName'),
      reporterPhone: get('reporterPhone'),
      agaf: normalizeAgaf(get('agafRaw')),
      slaPct: parseSlaPct(get('slaRaw')),
    };
  }).filter(t => t.id && t.openedAt);
}

// המשפחה הסגורה נצפתה בקבצים האמיתיים; כל השאר (בטיפול, בתכנית עבודה,
// מוחזרת עי הפונה...) מופיעות בייצוא הפתוחות של בינה - כלומר פתוחות
const CLOSED_EXACT = new Set(['לא יבוצע', 'פניה כפולה']);
export function isClosedStatus(status) {
  const s = (status || '').trim();
  return s.includes('הסתיים') || s.includes('סגור') || CLOSED_EXACT.has(s);
}

/**
 * שני סוגי ייצוא מבינה (docs/16): קובץ יום (מסונן תאריך, סטטוסים
 * מעורבים) וקובץ פתוחות (מסונן סטטוס, תאריכים מכל התקופה).
 */
export function detectExportKind(tickets) {
  const closed = tickets.filter(t => isClosedStatus(t.status)).length;
  const days = new Set(tickets.map(t => t.openedAt.toDateString()));
  if (closed === 0 || days.size > 4) return 'open';
  return 'day';
}

export const AGAF_ORDER = ['שפ"ע', 'בטחון', 'חינוך', 'הנדסה'];

/**
 * טבלת האגפים של הדוח: נפתחו/טופלו מקובץ היום (בחלון הדוח, כולל
 * פניות-בנות - כך נספר בדוחות הידניים), סך פתוחות/חורגות מקובץ
 * הפתוחות (ספירה גולמית; חורגת = SLA של 100% ומעלה). קובץ חסר
 * משאיר את העמודות שלו ריקות למילוי ידני.
 */
export function computeAgafTable(dayTickets, openTickets, reportDate) {
  const table = Object.fromEntries(
    AGAF_ORDER.map(name => [name, { opened: '', handled: '', open_total: '', overdue: '' }])
  );

  if (dayTickets?.length) {
    const { start, end } = reportWindow(reportDate);
    for (const name of AGAF_ORDER) table[name].opened = table[name].handled = 0;
    for (const t of dayTickets) {
      if (t.openedAt < start || t.openedAt > end || !table[t.agaf]) continue;
      table[t.agaf].opened++;
      if (isClosedStatus(t.status)) table[t.agaf].handled++;
    }
  }

  if (openTickets?.length) {
    for (const name of AGAF_ORDER) table[name].open_total = table[name].overdue = 0;
    for (const t of openTickets) {
      if (!table[t.agaf]) continue;
      table[t.agaf].open_total++;
      if (t.slaPct !== null && t.slaPct >= 100) table[t.agaf].overdue++;
    }
  }

  return table;
}

// יום רגיל: היום עצמו. יום ראשון: שישי-ראשון - בסופ"ש לא מופק דוח (docs/16)
export function reportWindow(reportDate) {
  const start = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate());
  if (reportDate.getDay() === 0) start.setDate(start.getDate() - 2);
  const end = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate(), 23, 59, 59);
  return { start, end };
}

export function prepareTickets(tickets, reportDate) {
  const { start, end } = reportWindow(reportDate);
  // עותקים - הפונקציה לא נוגעת בקלט, כדי שקריאה חוזרת (רינדור מחדש)
  // לא תנפח מונים או תכפיל מחלקות מקושרות
  const inWindow = tickets
    .filter(t => t.openedAt >= start && t.openedAt <= end)
    .map(t => ({ ...t }));

  // איחוד פניות-בנות: המחלקה של הבת נרשמת על האם, הבת יוצאת מהרשימה
  const byId = new Map(inWindow.map(t => [t.id, t]));
  const merged = [];
  let mergedCount = 0;
  for (const t of inWindow) {
    if (t.parentId && byId.has(t.parentId)) {
      const parent = byId.get(t.parentId);
      parent.linkedDepartments = [...(parent.linkedDepartments || []), t.department];
      mergedCount++;
      continue;
    }
    merged.push(t);
  }

  // קיבוץ כפילויות: אותה כתובת + אותו נושא באותו יום = אירוע אחד
  const seen = new Map();
  for (const t of merged) {
    const key = `${t.address}|${t.subject}|${t.openedAt.toDateString()}`;
    if (seen.has(key)) {
      const first = seen.get(key);
      first.groupCount = (first.groupCount || 1) + 1;
      t.groupedInto = first.id;
    } else seen.set(key, t);
  }

  return { tickets: merged, mergedCount };
}

// לפני כל שליחה ל-AI (שלב 2): זהות הפונה לא עוזבת את המערכת (docs/16)
export function stripPii(ticket) {
  const { reporterName, reporterPhone, ...clean } = ticket;
  return clean;
}
