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
 * רשימת העבודות המנוהלת → שורות הטיוטה: פעילות שכבר התחילו, עם דגל
 * overdue כשתאריך הסיום עבר (מוצג לשאלה "להסיר או להאריך?" - לא
 * נמחק בשקט; "אין צפי" יורדת רק ב"הסתיימה" מפורשת).
 */
export function projectRowsForReport(projects, reportDate) {
  const day = dateOnly(reportDate);
  const rows = [];
  for (const p of projects || []) {
    if (p.status !== 'active') continue;
    const start = p.start_date ? new Date(`${p.start_date}T12:00:00`) : null;
    if (start && dateOnly(start) > day) continue;
    const endDate = p.end_date ? new Date(`${p.end_date}T12:00:00`) : null;
    rows.push({
      id: p.id,
      description: p.description,
      owner: p.owner || '',
      start: start ? ilDate(start) : '',
      end: endDate ? ilDate(endDate) : p.end_date_approx || 'אין צפי לסיום',
      overdue: endDate ? dateOnly(endDate) < day : false,
    });
  }
  return rows;
}

// קלט תאריך ישראלי מהמשתמש → ערך date לשמירה; טקסט חופשי ("ספטמבר") → null
export function parseIlDate(str) {
  const m = String(str || '').trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (!m) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return `${year}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
}
