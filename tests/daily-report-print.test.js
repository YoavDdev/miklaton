import { describe, it, expect } from 'vitest';
import { buildReportHtml } from '@/lib/daily-report-print';

/**
 * YOA-42: הפקת ה-PDF היא עמוד הדפסה (הדפדפן מרנדר עברית RTL מושלם -
 * ההחלטה מ-docs/16). ה-HTML נבנה מאותו layout כמו ה-Excel.
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
      description: 'מספר פנייה: 600005\nמיקום: גן הפקאן',
      treatment: 'טיפול בפנייה: פקח במקום',
      handler: 'פיקוח',
    },
  ],
  city_events: [{ name: 'זומבה ביובל', date: '18.08.2026', hour: '20:00' }],
  works: [{ description: 'עבודות נת"ע בכביש 461', start: '16.08.2026', end: '20.08.2026', owner: 'נת"ע' }],
  writer_name: 'דנה אהרון',
};

describe('buildReportHtml', () => {
  const html = buildReportHtml(SNAPSHOT, 'יום שלישי 18.08.2026');

  it('מסמך RTL עם כותרת שהיא גם שם הקובץ המוצע', () => {
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('<title>דוח סיכום יומי יום שלישי 18.08.2026</title>');
  });

  it('כל המקטעים והערכים בפנים', () => {
    expect(html).toContain('שפ"ע');
    expect(html).toContain('107');
    expect(html).toContain('תקינות מצלמות');
    expect(html).toContain('אירועים חריגים');
    expect(html).toContain('מספר פנייה: 600005');
    expect(html).toContain('זומבה ביובל');
    expect(html).toContain('עבודות נת"ע בכביש 461');
    expect(html).toContain('כותב/ת הדוח: דנה אהרון');
    expect(html).toContain('מאשרת את הדוח : מירי צרפתי');
  });

  it('צבעי הדוח הידני והדפסת צבע מאולצת', () => {
    expect(html).toContain('#B4C6E7');
    expect(html).toContain('#8EAADB');
    expect(html).toContain('print-color-adjust');
  });

  it('תוכן עם תווי HTML לא נהפך לקוד - מוגן ב-escape', () => {
    const evil = buildReportHtml(
      { ...SNAPSHOT, writer_name: '<script>alert(1)</script>' },
      'יום'
    );
    expect(evil).not.toContain('<script>alert');
    expect(evil).toContain('&lt;script&gt;');
  });
});

describe('buildReportHtml — סמל העירייה', () => {
  it('הסמל והכיתוב בראש הדוח', () => {
    const html = buildReportHtml({ writer_name: 'בודקת' }, 'יום רביעי 26.08.2026');
    expect(html).toContain('/city-logo.png');
    expect(html).toContain('עיריית יהוד-מונוסון');
  });
});
