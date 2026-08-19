import * as XLSX from 'xlsx';

/**
 * בונה את דוח הסיכום היומי בפורמט המדויק של הדוח הידני הקיים (YOA-42),
 * כדי שרשימת התפוצה במייל לא תרגיש שום שינוי. "תאריל" - כך במקור.
 */
const AGAF_ORDER = ['שפ"ע', 'בטחון', 'חינוך', 'הנדסה'];

export function buildReportRows(snapshot, reportDateLabel) {
  const rows = [];
  rows.push([`דוח סיכום יומי ${reportDateLabel}`]);
  rows.push([]);
  rows.push(['אגף', 'קריאות שנפתחו', 'קריאות שטופלו', 'סך כל הקריאות הפתוחות', 'קריאות חורגות מתוך הפתוחות']);
  for (const name of AGAF_ORDER) {
    const a = snapshot.agaf?.[name] || {};
    rows.push([name, a.opened ?? '', a.handled ?? '', a.open_total ?? '', a.overdue ?? '']);
  }
  rows.push([]);
  rows.push(['תקינות מצלמות', 'מספר מצלמות']);
  rows.push(['תקין', snapshot.cameras?.ok ?? '']);
  rows.push(['לא תקין', snapshot.cameras?.broken ?? '']);
  rows.push([]);
  rows.push(['אירועים חריגים']);
  rows.push(['שעה ותאריך', 'תיאור האירוע', 'דרך טיפול', 'גורם מטפל']);
  for (const e of snapshot.exceptional || []) {
    rows.push([e.time_label, e.description, e.treatment, e.handler]);
  }
  rows.push(['אירועים בעיר', 'תאריך', 'שעה']);
  for (const ev of snapshot.city_events || []) {
    rows.push([ev.name, ev.date, ev.hour]);
  }
  rows.push(['פרוייקט', 'תאריך התחלה', 'תאריל משוער לסיום', 'אחריות']);
  for (const w of snapshot.works || []) {
    rows.push([w.description, w.start, w.end, w.owner]);
  }
  rows.push(['', `כותב/ת הדוח: ${snapshot.writer_name || ''}`]);
  rows.push(['', 'מאשרת את הדוח : מירי צרפתי']);
  return rows;
}

export function buildReportWorkbook(snapshot, reportDateLabel) {
  const ws = XLSX.utils.aoa_to_sheet(buildReportRows(snapshot, reportDateLabel));
  ws['!cols'] = [{ wch: 30 }, { wch: 60 }, { wch: 40 }, { wch: 18 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'גיליון1');
  return wb;
}
