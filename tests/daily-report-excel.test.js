import { describe, it, expect } from 'vitest';
import { buildReportRows, buildReportLayout, buildStyledWorkbook } from '@/lib/daily-report-excel';

/**
 * YOA-42 (docs/16): ה-Excel המופק חייב להיות זהה בפורמט לדוח הידני
 * הקיים - רשימת התפוצה במייל לא אמורה להרגיש שום שינוי. המבנה כאן
 * הועתק מ"דוח סיכום יומי 18.08.2026.xlsx" האמיתי.
 */
const SNAPSHOT = {
  agaf: {
    'שפ"ע': { opened: 97, handled: 57, open_total: 107, overdue: 8 },
    'בטחון': { opened: 33, handled: 26, open_total: 21, overdue: 9 },
    'חינוך': { opened: 4, handled: 0, open_total: 76, overdue: 44 },
    'הנדסה': { opened: 12, handled: 3, open_total: 60, overdue: 29 },
  },
  cameras: { ok: 106, broken: 1 },
  exceptional: [
    {
      ticket_id: '600005',
      time_label: '16.08 07:50',
      description: 'מספר פנייה: 600005\nמיקום: גן הפקאן\nתיאור הפנייה: אדם מבוגר נפל בגן',
      treatment: 'טיפול בפנייה: פקח ביצע חבישה עד הגעת מד"א',
      handler: 'פיקוח',
    },
  ],
  city_events: [{ name: 'זומבה ביובל', date: '18.08.2026', hour: '20:00' }],
  works: [{ description: 'עבודות נת"ע בכביש 461', start: '16.08.2026', end: '20.08.2026', owner: 'נת"ע' }],
  writer_name: 'דנה אהרון',
};

describe('buildReportRows — הפורמט של הדוח הקיים', () => {
  const rows = buildReportRows(SNAPSHOT, 'יום שלישי 18.08.2026');

  it('כותרת, טבלת אגפים ומצלמות במקומן', () => {
    expect(rows[0][0]).toBe('דוח סיכום יומי יום שלישי 18.08.2026');
    expect(rows[2][0]).toBe('אגף');
    expect(rows[3]).toEqual(['שפ"ע', 97, 57, 107, 8]);
    expect(rows[8][0]).toBe('תקינות מצלמות');
    expect(rows[9]).toEqual(['תקין', 106]);
  });

  it('אירוע חריג עם כל ארבע העמודות', () => {
    const i = rows.findIndex(r => r[0] === 'אירועים חריגים');
    expect(rows[i + 1][0]).toBe('שעה ותאריך');
    expect(rows[i + 2][1]).toContain('מספר פנייה: 600005');
    expect(rows[i + 2][3]).toBe('פיקוח');
  });

  it('אירועים בעיר, עבודות, וחתימות בסוף', () => {
    const events = rows.findIndex(r => r[0] === 'אירועים בעיר');
    expect(rows[events + 1][0]).toBe('זומבה ביובל');
    const works = rows.findIndex(r => r[0] === 'פרוייקט');
    expect(rows[works + 1][3]).toBe('נת"ע');
    expect(rows[rows.length - 2][1]).toBe('כותב/ת הדוח: דנה אהרון');
    expect(rows[rows.length - 1][1]).toBe('מאשרת את הדוח : מירי צרפתי');
  });

  it('snapshot חלקי לא מפיל את הבנייה - תאים ריקים במקום', () => {
    const rows2 = buildReportRows({ writer_name: 'בודק' }, 'יום רביעי 19.08.2026');
    expect(rows2[3][0]).toBe('שפ"ע');
    expect(rows2[3][1]).toBe('');
    expect(rows2[rows2.length - 2][1]).toBe('כותב/ת הדוח: בודק');
  });
});

describe('buildReportLayout — מבנה עם סוגי שורות לעיצוב', () => {
  const layout = buildReportLayout(SNAPSHOT, 'יום שלישי 18.08.2026');

  it('אותו סדר שורות כמו buildReportRows', () => {
    const rows = buildReportRows(SNAPSHOT, 'יום שלישי 18.08.2026');
    expect(layout.map(r => r.cells)).toEqual(rows);
  });

  it('סוגי השורות נכונים: כותרת, כותרות מקטע, נתונים וחתימות', () => {
    expect(layout[0].kind).toBe('title');
    expect(layout[1].kind).toBe('spacer');
    expect(layout[2].kind).toBe('header');
    expect(layout[3].kind).toBe('data');
    const section = layout.find(r => r.cells[0] === 'אירועים חריגים');
    expect(section.kind).toBe('section');
    expect(layout[layout.length - 1].kind).toBe('signature');
  });
});

describe('buildStyledWorkbook — העיצוב של הדוח הידני', () => {
  const wb = buildStyledWorkbook(SNAPSHOT, 'יום שלישי 18.08.2026');
  const ws = wb.getWorksheet('גיליון1');

  it('גיליון RTL עם רוחבי עמודות', () => {
    expect(ws.views[0].rightToLeft).toBe(true);
    expect(ws.getColumn(1).width).toBeGreaterThan(20);
  });

  it('שורת הכותרת כחולה ומודגשת', () => {
    const c = ws.getCell('A1');
    expect(c.fill.fgColor.argb).toBe('FF8EAADB');
    expect(c.font.bold).toBe(true);
  });

  it('כותרת טבלת האגפים בכחול בהיר, הנתונים עם גבולות', () => {
    expect(ws.getCell('A3').fill.fgColor.argb).toBe('FFB4C6E7');
    expect(ws.getCell('A3').font.bold).toBe(true);
    expect(ws.getCell('B4').value).toBe(97);
    expect(ws.getCell('B4').border.top.style).toBe('thin');
  });

  it('שורת אירוע ארוכה מקבלת גובה מוגדל וגלישת טקסט', () => {
    const i = 1 + buildReportRows(SNAPSHOT, 'x').findIndex(r => String(r[1] || '').includes('600005'));
    const row = ws.getRow(i);
    expect(row.height).toBeGreaterThan(30);
    expect(ws.getCell(`B${i}`).alignment.wrapText).toBe(true);
  });
});

describe('buildStyledWorkbook — סמל העירייה', () => {
  it('עם לוגו: שורת סמל בראש, הכותרת יורדת לשורה 2 והתמונה מוטמעת', async () => {
    const { buildStyledWorkbook } = await import('@/lib/daily-report-excel');
    const logo = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // תחילת PNG - מספיק להטמעה
    const wb = buildStyledWorkbook(SNAPSHOT, 'יום שלישי 18.08.2026', logo);
    const ws = wb.getWorksheet('גיליון1');
    expect(ws.getCell('A2').value).toContain('דוח סיכום יומי');
    expect(ws.getImages().length).toBe(1);
    expect(ws.getRow(1).height).toBe(78);
  });

  it('בלי לוגו: הפורמט הישן בדיוק - הכותרת בשורה 1', async () => {
    const { buildStyledWorkbook } = await import('@/lib/daily-report-excel');
    const wb = buildStyledWorkbook(SNAPSHOT, 'יום שלישי 18.08.2026');
    const ws = wb.getWorksheet('גיליון1');
    expect(ws.getCell('A1').value).toContain('דוח סיכום יומי');
    expect(ws.getImages().length).toBe(0);
  });
});
