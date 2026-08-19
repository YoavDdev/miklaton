import { describe, it, expect } from 'vitest';
import { buildReportRows } from '@/lib/daily-report-excel';

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
