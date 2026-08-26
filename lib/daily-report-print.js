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
 * צד לקוח בלבד: מוריד את הדוח כקובץ PDF עם שם מסודר. הרינדור נעשה
 * בקונטיינר סמוי, וממתינים לסמל להיטען כדי שלא ייצא ריק.
 */
export async function downloadPdf(snapshot, reportDateLabel, fileName) {
  const html2pdf = (await import('html2pdf.js')).default;

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff;';
  container.innerHTML = buildReportBodyHtml(snapshot, reportDateLabel);
  document.body.appendChild(container);
  try {
    await Promise.all(
      [...container.querySelectorAll('img')].map((img) => img.decode().catch(() => {}))
    );
    await html2pdf()
      .set({
        margin: [8, 8, 10, 8],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      })
      .from(container)
      .save();
  } finally {
    container.remove();
  }
}
