import ExcelJS from 'exceljs';

/**
 * בונה את דוח הסיכום היומי בפורמט המדויק של הדוח הידני הקיים (YOA-42),
 * כדי שרשימת התפוצה במייל לא תרגיש שום שינוי. "תאריל" - כך במקור.
 * העיצוב (צבעים, גבולות, גבהים) נמדד מהדוח האמיתי של 26.08.2026.
 */
const AGAF_ORDER = ['שפ"ע', 'בטחון', 'חינוך', 'הנדסה'];

const TITLE_FILL = 'FF8EAADB'; // accent1 40% - שורת הכותרת
const HEADER_FILL = 'FFB4C6E7'; // accent1 60% - כותרות המקטעים
const COL_WIDTHS = [31, 45, 30, 16, 16];

export function buildReportLayout(snapshot, reportDateLabel) {
  const rows = [];
  const push = (kind, cells) => rows.push({ kind, cells });

  push('title', [`דוח סיכום יומי ${reportDateLabel}`]);
  push('spacer', []);
  push('header', ['אגף', 'קריאות שנפתחו', 'קריאות שטופלו', 'סך כל הקריאות הפתוחות', 'קריאות חורגות מתוך הפתוחות']);
  for (const name of AGAF_ORDER) {
    const a = snapshot.agaf?.[name] || {};
    push('data', [name, a.opened ?? '', a.handled ?? '', a.open_total ?? '', a.overdue ?? '']);
  }
  push('spacer', []);
  push('header', ['תקינות מצלמות', 'מספר מצלמות']);
  push('data', ['תקין', snapshot.cameras?.ok ?? '']);
  push('data', ['לא תקין', snapshot.cameras?.broken ?? '']);
  push('spacer', []);
  push('section', ['אירועים חריגים']);
  push('header', ['שעה ותאריך', 'תיאור האירוע', 'דרך טיפול', 'גורם מטפל']);
  const exceptional = snapshot.exceptional || [];
  if (exceptional.length === 0) {
    // יום בלי חריגים הוא המצב הרגיל - הדוח אומר זאת במפורש ובמקצועיות,
    // לא משאיר מקטע ריק (בקשת יואב 26.08)
    push('data', ['', 'לא נרשמו אירועים חריגים ביום זה.', '', '']);
  }
  for (const e of exceptional) {
    push('data', [e.time_label, e.description, e.treatment, e.handler]);
  }
  push('header', ['אירועים בעיר', 'תאריך', 'שעה']);
  for (const ev of snapshot.city_events || []) {
    push('data', [ev.name, ev.date, ev.hour]);
  }
  push('header', ['פרוייקט', 'תאריך התחלה', 'תאריל משוער לסיום', 'אחריות']);
  for (const w of snapshot.works || []) {
    push('data', [w.description, w.start, w.end, w.owner]);
  }
  push('signature', ['', `כותב/ת הדוח: ${snapshot.writer_name || ''}`]);
  push('signature', ['', 'מאשרת את הדוח : מירי צרפתי']);
  return rows;
}

export function buildReportRows(snapshot, reportDateLabel) {
  return buildReportLayout(snapshot, reportDateLabel).map(r => r.cells);
}

// גובה שורה לפי התוכן: הטקסט גולש בתוך התא, לא נבלע
function estimateHeight(cells) {
  let maxLines = 1;
  cells.forEach((v, i) => {
    const width = COL_WIDTHS[i] || 16;
    const lines = String(v ?? '')
      .split('\n')
      .reduce((n, line) => n + Math.max(1, Math.ceil(line.length / (width * 1.4))), 0);
    if (lines > maxLines) maxLines = lines;
  });
  return Math.max(30, maxLines * 16 + 8);
}

const THIN = { style: 'thin', color: { argb: 'FF000000' } };

export function buildStyledWorkbook(snapshot, reportDateLabel, logoBuffer = null) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('גיליון1', { views: [{ rightToLeft: true }] });
  COL_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // סמל העירייה בשורה משלו מעל הכותרת (בקשת יואב 26.08). בגיליון RTL
  // עמודה A מוצגת מימין - הסמל יושב בפינה הימנית כמו במסמך רשמי.
  const offset = logoBuffer ? 1 : 0;
  if (logoBuffer) {
    const imageId = wb.addImage({ buffer: logoBuffer, extension: 'png' });
    ws.addImage(imageId, { tl: { col: 0.1, row: 0.1 }, ext: { width: 62, height: 96 } });
    ws.getRow(1).height = 78;
  }

  const layout = buildReportLayout(snapshot, reportDateLabel);
  layout.forEach((r, idx) => {
    const row = ws.getRow(idx + 1 + offset);
    if (r.kind === 'spacer') { row.height = 12; return; }

    r.cells.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = typeof v === 'number' || v === '' || v == null ? (v ?? '') : String(v);
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      if (r.kind === 'title') {
        cell.font = { name: 'Arial', size: 12, bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TITLE_FILL } };
      } else if (r.kind === 'header' || r.kind === 'section') {
        cell.font = { name: 'Arial', size: r.cells[0] === 'אגף' ? 16 : 14, bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
      } else if (r.kind === 'signature') {
        cell.font = { name: 'Arial', size: 12, bold: true };
        if (v) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
      } else {
        cell.font = { name: 'Assistant', size: 14 };
      }
      cell.border = { top: THIN, bottom: THIN, left: THIN, right: THIN };
    });
    row.height = r.kind === 'header' ? 40 : r.kind === 'data' ? estimateHeight(r.cells) : 30;
  });

  return wb;
}

// צד לקוח בלבד: הורדת הקובץ מהדפדפן. הסמל לא חוסם - אם לא נטען,
// הדוח יוצא בלעדיו (אותו עיקרון אי-תלות כמו אתר העירייה וה-AI).
export async function downloadStyledExcel(snapshot, reportDateLabel, fileName) {
  let logoBuffer = null;
  try {
    const res = await fetch('/city-logo.png');
    if (res.ok) logoBuffer = await res.arrayBuffer();
  } catch { /* בלי סמל */ }
  const wb = buildStyledWorkbook(snapshot, reportDateLabel, logoBuffer);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
