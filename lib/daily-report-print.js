import { buildReportLayout } from './daily-report-excel';

/**
 * הפקת PDF לדוח היומי (YOA-42): הדפדפן מרנדר את ה-HTML (עברית RTL
 * מושלמת בלי תלות בשרת), ו-html2pdf.js שומר אותו כקובץ PDF אמיתי
 * שיורד ישירות עם שם מסודר - בלי לעבור דרך חלון ההדפסה (בקשת יואב
 * 26.08). מקור האמת למבנה הוא אותו layout של ה-Excel.
 */

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

const STYLE = `
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  .report-root { font-family: Arial, 'Segoe UI', sans-serif; color: #000; background: #fff; direction: rtl; padding: 16px; }
  .report-root table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .report-root col.c1 { width: 24%; } .report-root col.c2 { width: 32%; } .report-root col.c3 { width: 20%; }
  .report-root col.c4 { width: 12%; } .report-root col.c5 { width: 12%; }
  .report-root th, .report-root td { border: 1px solid #444; padding: 6px 8px; text-align: center; vertical-align: middle; word-wrap: break-word; }
  .report-root .report-head { display: flex; flex-direction: column; align-items: center; gap: 2px; margin-bottom: 12px; }
  .report-root .report-head img { height: 84px; }
  .report-root .report-head div { font-size: 15px; font-weight: bold; color: #1f2a63; }
  .report-root tr.title th { background: #8EAADB; font-size: 16px; font-weight: bold; padding: 10px; }
  .report-root tr.header th, .report-root tr.section th { background: #B4C6E7; font-size: 14px; font-weight: bold; }
  .report-root tr.signature th { background: #B4C6E7; font-size: 12px; }
  .report-root tr.signature th:first-child { background: transparent; border: none; }
  .report-root tr.data td { font-size: 13px; }
  .report-root tr.spacer td { border: none; height: 10px; }
`;

// תוכן הדוח (סגנון + סמל + טבלה) - משותף לחלון ההדפסה ולהורדת ה-PDF
export function buildReportBodyHtml(snapshot, reportDateLabel) {
  const layout = buildReportLayout(snapshot, reportDateLabel);
  // סמל העירייה בראש הדוח. origin מפורש - חלון חדש נפתח על about:blank
  // ונתיב יחסי לא היה נפתר.
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const body = layout
    .map(({ kind, cells }) => {
      if (kind === 'spacer') return '<tr class="spacer"><td colspan="5"></td></tr>';
      const tag = kind === 'data' ? 'td' : 'th';
      const span = 5 - cells.length + 1;
      return `<tr class="${kind}">${cells
        .map((c, i) => `<${tag}${i === cells.length - 1 && span > 1 ? ` colspan="${span}"` : ''}>${esc(c)}</${tag}>`)
        .join('')}</tr>`;
    })
    .join('\n');

  return `<style>${STYLE}</style>
<div class="report-root">
<div class="report-head"><img src="${origin}/city-logo.png" alt="סמל העירייה"><div>עיריית יהוד-מונוסון</div></div>
<table>
<colgroup><col class="c1"><col class="c2"><col class="c3"><col class="c4"><col class="c5"></colgroup>
${body}
</table>
</div>`;
}

export function buildReportHtml(snapshot, reportDateLabel) {
  const title = `דוח סיכום יומי ${reportDateLabel}`;
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
</head>
<body style="margin:0">
${buildReportBodyHtml(snapshot, reportDateLabel)}
</body>
</html>`;
}

/**
 * צד לקוח בלבד: מוריד את הדוח כקובץ PDF עם שם מסודר.
 * html2canvas מצלם את הדוח (עברית RTL מרונדרת על ידי הדפדפן עצמו)
 * ו-jsPDF פורס את הצילום לעמודי A4. עובדים עם הספריות ישירות -
 * העטיפה html2pdf.js צילמה דף ריק בכרום מודרני (אומת 26.08).
 */
export async function downloadPdf(snapshot, reportDateLabel, fileName) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  // position:fixed מחוץ למסך גורם לצילום ריק - לכן הקונטיינר יושב
  // בראש הדף מאחורי האפליקציה (z-index שלילי; הרקע האטום מכסה אותו).
  const container = document.createElement('div');
  container.style.cssText = 'position:absolute;top:0;left:0;width:794px;background:#fff;z-index:-9999;';
  container.innerHTML = buildReportBodyHtml(snapshot, reportDateLabel);
  document.body.appendChild(container);
  try {
    // הסמל חייב להיטען לפני הצילום - אחרת ייצא חור
    await Promise.all(
      [...container.querySelectorAll('img')].map((img) => img.decode().catch(() => {}))
    );

    const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff' });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const margin = 8;
    const pageW = 210 - margin * 2;
    const pageH = 297 - margin * 2;
    const pxPerMm = canvas.width / pageW;
    const pageHpx = Math.floor(pageH * pxPerMm);

    let y = 0;
    let pageNum = 0;
    while (y < canvas.height) {
      const sliceH = Math.min(pageHpx, canvas.height - y);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceH;
      slice.getContext('2d').drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      if (pageNum > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', margin, margin, pageW, sliceH / pxPerMm);
      y += sliceH;
      pageNum++;
    }

    pdf.save(fileName);
  } finally {
    container.remove();
  }
}
