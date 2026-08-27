import { reportWindow } from '@/lib/binaa-tickets';

/**
 * YOA-42 שלב 3 (docs/16): המקורות האוטומטיים של מקטעי "אירועים בעיר"
 * ו"עבודות בעיר". לוגיקה טהורה - הראוטים והדף רק מחווטים אותה.
 */

const pad = (n) => String(n).padStart(2, '0');
const ilDate = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;

// הכותרות מגיעות מ-WordPress עם entities כמו &#039;
function decodeEntities(text) {
  return String(text || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function cleanLocation(location) {
  return String(location || '')
    .replace(/\s+/g, ' ')
    .replace(/יהוד\s*-\s*מונוסון\.?$/, '')
    .trim();
}

/**
 * אירועי ה-API של אתר העירייה (wp-json/wp/v2/events) → שורות המקטע,
 * מסונן לחלון הדוח (ביום ראשון: שישי-ראשון) וממוין תאריך+שעה.
 */
export function mapCityEvents(wpEvents, reportDate) {
  const { start, end } = reportWindow(reportDate);
  const rows = [];
  for (const ev of wpEvents || []) {
    const raw = ev?.acf?.event_date;
    const m = String(raw || '').match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!m) continue;
    const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
    if (date < start || date > end) continue;
    const title = decodeEntities(ev.title?.rendered).trim();
    const location = cleanLocation(ev.acf.location);
    const hour = String(ev.acf.event_hours || '').match(/^(\d{2}:\d{2})/)?.[1] || '';
    rows.push({
      name: location ? `${title} - ${location}` : title,
      date: ilDate(date),
      hour,
      sortKey: `${raw} ${hour}`,
    });
  }
  rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return rows.map(({ sortKey, ...row }) => row);
}

const dateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * רשימת העבודות המנוהלת → שורות הטיוטה: פעילות שכבר התחילו ושתאריך
 * הסיום שלהן לא עבר. עבודה עם תאריך סיום נעלמת אוטומטית למחרת -
 * בלי שום פעולה ידנית (החלטת יואב 27.08, החליפה את דגל ה"הסתיימה?").
 * "אין צפי" והערכות טקסט ("ספטמבר") יורדות רק ב"הסתיימה" מפורשת.
 */
export function projectRowsForReport(projects, reportDate) {
  const day = dateOnly(reportDate);
  const rows = [];
  for (const p of projects || []) {
    if (p.status !== 'active') continue;
    const start = p.start_date ? new Date(`${p.start_date}T12:00:00`) : null;
    if (start && dateOnly(start) > day) continue;
    const endDate = p.end_date ? new Date(`${p.end_date}T12:00:00`) : null;
    if (endDate && dateOnly(endDate) < day) continue; // הסתיימה מעצמה
    rows.push({
      id: p.id,
      description: p.description,
      owner: p.owner || '',
      start: start ? ilDate(start) : '',
      end: endDate ? ilDate(endDate) : p.end_date_approx || 'אין צפי לסיום',
    });
  }
  return rows;
}

// קלט תאריך מהמשתמש → ערך date לשמירה. מקבל DD.MM.YYYY (הקלדה ישנה)
// וגם YYYY-MM-DD (בורר התאריכים); טקסט חופשי ("ספטמבר") → null
export function parseIlDate(str) {
  const s = String(str || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (!m) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return `${year}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
}

// DD.MM.YYYY → YYYY-MM-DD עבור <input type="date">; לא-תאריך → ''
export const ilToIso = (str) => parseIlDate(str) || '';

// YYYY-MM-DD → DD.MM.YYYY לתצוגה בדוח; ריק → ''
export function isoToIl(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

// היום בפורמט הדוח - ברירת המחדל של תאריך התחלה לעבודה חדשה
export function todayIl() {
  return ilDate(new Date());
}
