import { describe, it, expect } from 'vitest';
import { mapCityEvents, projectRowsForReport, parseIlDate, ilToIso, isoToIl } from '@/lib/daily-report-city';

/**
 * YOA-42 שלב 3 (docs/16): אירועים בעיר נמשכים מאתר העירייה לפי חלון
 * הדוח, ועבודות בעיר מסוננות לפי טווחי תאריכים - כולל דגל "הסתיימה".
 */
const wpEvent = (date, hours, title, location) => ({
  title: { rendered: title },
  acf: { event_date: date, event_hours: hours, location },
});

describe('mapCityEvents', () => {
  const events = [
    wpEvent('20260826', '09:00:00', 'גן עם הורה Sensory Hub', 'מרכז התחל"ה רחוב הדגנים 54 יהוד-מונוסון'),
    wpEvent('20260826', '17:00:00', 'הפנינג כדורסל', '\tאולם היובל'),
    wpEvent('20260827', '10:00:00', 'אירוע של מחר', 'מקום'),
    wpEvent('20261118', '16:30:00', 'אירוע רחוק', 'מקום'),
  ];

  it('מסנן ליום הדוח בלבד וממיר פורמטים', () => {
    const rows = mapCityEvents(events, new Date(2026, 7, 26));
    expect(rows.length).toBe(2);
    expect(rows[0]).toEqual({
      name: 'גן עם הורה Sensory Hub - מרכז התחל"ה רחוב הדגנים 54',
      date: '26.08.2026',
      hour: '09:00',
    });
  });

  it('מיקום עם טאבים מנוקה, המיון לפי שעה', () => {
    const rows = mapCityEvents(events, new Date(2026, 7, 26));
    expect(rows[1].name).toBe('הפנינג כדורסל - אולם היובל');
    expect(rows[1].hour).toBe('17:00');
  });

  it('ביום ראשון החלון כולל שישי ושבת', () => {
    const weekend = [
      wpEvent('20260821', '10:00:00', 'שישי', 'א'),
      wpEvent('20260822', '10:00:00', 'שבת', 'ב'),
      wpEvent('20260823', '10:00:00', 'ראשון', 'ג'),
      wpEvent('20260820', '10:00:00', 'חמישי', 'ד'),
    ];
    const rows = mapCityEvents(weekend, new Date(2026, 7, 23));
    expect(rows.map(r => r.name.split(' - ')[0])).toEqual(['שישי', 'שבת', 'ראשון']);
  });

  it('HTML entities בכותרת מפוענחים', () => {
    const rows = mapCityEvents(
      [wpEvent('20260826', '10:00:00', 'ג&#039;ימבורי &amp; משחק', '')],
      new Date(2026, 7, 26)
    );
    expect(rows[0].name).toBe("ג'ימבורי & משחק");
  });

  it('אירוע בלי acf לא מפיל', () => {
    expect(mapCityEvents([{ title: { rendered: 'ריק' } }], new Date(2026, 7, 26))).toEqual([]);
  });
});

describe('projectRowsForReport', () => {
  const projects = [
    { id: 'p1', description: 'גינדי גדות', owner: 'חכ"ל', start_date: null, end_date: null, end_date_approx: null, status: 'active' },
    { id: 'p2', description: 'פינוי בינוי', owner: 'התחדשות', start_date: '2024-12-31', end_date: null, end_date_approx: null, status: 'active' },
    { id: 'p3', description: 'מובל נורדאו', owner: 'חכ"ל', start_date: '2026-08-02', end_date: null, end_date_approx: 'ספטמבר', status: 'active' },
    { id: 'p4', description: 'עבודות לילה', owner: 'נת"ע', start_date: '2026-08-16', end_date: '2026-08-20', end_date_approx: null, status: 'active' },
    { id: 'p5', description: 'הסתיימה מזמן', owner: 'x', start_date: null, end_date: null, end_date_approx: null, status: 'ended' },
    { id: 'p6', description: 'עתידית', owner: 'y', start_date: '2026-09-10', end_date: null, end_date_approx: null, status: 'active' },
  ];

  const rows = projectRowsForReport(projects, new Date(2026, 7, 26));

  it('פעילות בלבד, בלי עתידיות, בלי שהסתיימו - ותאריך סיום שעבר נעלם לבד', () => {
    // p4 (סיום 20.08) לא ברשימה של 26.08 - הסתיימה אוטומטית, בלי מגע יד
    expect(rows.map(r => r.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('תצוגת התאריכים כמו בדוח הידני', () => {
    const p2 = rows.find(r => r.id === 'p2');
    expect(p2.start).toBe('31.12.2024');
    expect(p2.end).toBe('אין צפי לסיום');
    expect(rows.find(r => r.id === 'p3').end).toBe('ספטמבר');
    expect(rows.find(r => r.id === 'p1').start).toBe('');
  });

  it('עבודה שנגמרת בדיוק ביום הדוח עדיין מופיעה - נעלמת רק למחרת', () => {
    const projectsToday = [{ id: 'p', description: 'א', status: 'active', start_date: null, end_date: '2026-08-26', end_date_approx: null }];
    expect(projectRowsForReport(projectsToday, new Date(2026, 7, 26)).length).toBe(1);
    expect(projectRowsForReport(projectsToday, new Date(2026, 7, 27)).length).toBe(0);
  });
});

describe('המרות תאריכים לבורר', () => {
  it('parseIlDate מקבל גם ISO מבורר התאריכים', () => {
    expect(parseIlDate('2026-08-20')).toBe('2026-08-20');
    expect(parseIlDate('20.08.2026')).toBe('2026-08-20');
  });

  it('ilToIso ו-isoToIl הפיכות; טקסט חופשי לא נשבר', () => {
    expect(ilToIso('23.02.2025')).toBe('2025-02-23');
    expect(isoToIl('2025-02-23')).toBe('23.02.2025');
    expect(ilToIso('ספטמבר')).toBe('');
    expect(isoToIl('')).toBe('');
  });
});

describe('parseIlDate', () => {
  it('DD.MM.YYYY וגם DD.MM.YY', () => {
    expect(parseIlDate('20.08.2026')).toBe('2026-08-20');
    expect(parseIlDate('01.02.25')).toBe('2025-02-01');
  });

  it('טקסט חופשי מחזיר null', () => {
    expect(parseIlDate('ספטמבר')).toBeNull();
    expect(parseIlDate('')).toBeNull();
    expect(parseIlDate('אין צפי')).toBeNull();
  });
});
