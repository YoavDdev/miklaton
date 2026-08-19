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
};

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
    idx[key] = header.indexOf(hebrew);
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
    };
  }).filter(t => t.id && t.openedAt);
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
