import { buildReportLayout } from './daily-report-excel';

/**
 * הפקת PDF לדוח היומי (YOA-42): עמוד HTML מעוצב להדפסה שנפתח בחלון
 * חדש - "שמירה כ-PDF" של הדפדפן נותנת עברית RTL מושלמת בלי תלות
 * חדשה ובלי סיכון רינדור בשרת (ההחלטה מ-docs/16). מקור האמת למבנה
 * הוא אותו layout של ה-Excel.
 */

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

export function buildReportHtml(snapshot, reportDateLabel) {
  const layout = buildReportLayout(snapshot, reportDateLabel);
  const title = `דוח סיכום יומי ${reportDateLabel}`;

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

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, 'Segoe UI', sans-serif; margin: 24px; color: #000; background: #fff; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  col.c1 { width: 24%; } col.c2 { width: 32%; } col.c3 { width: 20%; }
  col.c4 { width: 12%; } col.c5 { width: 12%; }
  th, td { border: 1px solid #444; padding: 6px 8px; text-align: center; vertical-align: middle; word-wrap: break-word; }
  tr.title th { background: #8EAADB; font-size: 16px; font-weight: bold; padding: 10px; }
  tr.header th, tr.section th { background: #B4C6E7; font-size: 14px; font-weight: bold; }
  tr.signature th { background: #B4C6E7; font-size: 12px; }
  tr.signature th:first-child { background: transparent; border: none; }
  tr.data td { font-size: 13px; }
  tr.spacer td { border: none; height: 10px; }
  @media print { body { margin: 8mm; } tr { page-break-inside: avoid; } }
</style>
</head>
<body>
<table>
<colgroup><col class="c1"><col class="c2"><col class="c3"><col class="c4"><col class="c5"></colgroup>
${body}
</table>
</body>
</html>`;
}

// נקרא רק מלחיצת כפתור - פתיחה אוטומטית נחסמת על ידי חוסמי פופאפ
export function openPrintPdf(snapshot, reportDateLabel) {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(buildReportHtml(snapshot, reportDateLabel));
  win.document.close();
  win.focus();
  // print אחרי שהדפדפן סיים לפרסס - התמונה בדיאלוג תהיה שלמה
  setTimeout(() => win.print(), 300);
  return true;
}
