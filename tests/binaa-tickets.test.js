import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import {
  parseTicketsCsv,
  reportWindow,
  prepareTickets,
  stripPii,
  isClosedStatus,
  detectExportKind,
  computeAgafTable,
} from '@/lib/binaa-tickets';

/**
 * YOA-42 (docs/16): הפרסר של ייצוא הפניות מבינה 360. ה-fixture סינתטי
 * אבל בפורמט המדויק של הייצוא האמיתי - BOM, מרכאות, שורת-שורה בשדה,
 * פנייה-בת עם סיומת, וכפילות של אותו אירוע.
 */
const FIXTURE = fs.readFileSync(
  path.join(process.cwd(), 'tests', 'fixtures', 'binaa-tickets-sample.csv'),
  'utf8'
);

describe('parseTicketsCsv', () => {
  const tickets = parseTicketsCsv(FIXTURE);

  it('קורא את כל השורות, כולל BOM ושדה עם שורת-שורה בתוכו', () => {
    expect(tickets.length).toBe(10);
    const multi = tickets.find(t => t.id === '600007');
    expect(multi.description).toContain('קרשים עם מסמרים');
  });

  it('מפענח תאריך ושעה ישראליים (DD/MM/YY HH:MM)', () => {
    const t = tickets.find(t => t.id === '600010');
    expect(t.openedAt.getFullYear()).toBe(2026);
    expect(t.openedAt.getMonth()).toBe(7);
    expect(t.openedAt.getDate()).toBe(16);
    expect(t.openedAt.getHours()).toBe(21);
  });

  it('מרכאות כפולות בתוך שדה נקראות כמרכאה אחת', () => {
    const t = tickets.find(t => t.id === '600005');
    expect(t.handler).toContain('מד"א');
  });

  it('מזהה פנייה-בת לפי סיומת', () => {
    const child = tickets.find(t => t.id === '600007-ב');
    expect(child.parentId).toBe('600007');
    const parent = tickets.find(t => t.id === '600007');
    expect(parent.parentId).toBeNull();
  });
});

describe('reportWindow', () => {
  it('יום חול: אותו יום בלבד', () => {
    const w = reportWindow(new Date(2026, 7, 18)); // שלישי
    expect(w.start.getDate()).toBe(18);
    expect(w.end.getDate()).toBe(18);
  });

  it('יום ראשון: משישי עד ראשון (כלל הסופ"ש)', () => {
    const w = reportWindow(new Date(2026, 7, 16)); // ראשון
    expect(w.start.getDate()).toBe(14);
    expect(w.end.getDate()).toBe(16);
  });
});

describe('prepareTickets', () => {
  const all = parseTicketsCsv(FIXTURE);

  it('דוח יום ראשון כולל את פניות שישי ושבת', () => {
    const { tickets } = prepareTickets(all, new Date(2026, 7, 16));
    const ids = tickets.map(t => t.id);
    expect(ids).toContain('600002'); // שישי
    expect(ids).toContain('600004'); // שבת
  });

  it('דוח יום חול לא כולל ימים קודמים', () => {
    const { tickets } = prepareTickets(all, new Date(2026, 7, 15));
    expect(tickets.map(t => t.id)).not.toContain('600010');
  });

  it('פנייה-בת מתאחדת לתוך האם ולא מופיעה בנפרד', () => {
    const { tickets, mergedCount } = prepareTickets(all, new Date(2026, 7, 16));
    expect(tickets.find(t => t.id === '600007-ב')).toBeUndefined();
    const parent = tickets.find(t => t.id === '600007');
    expect(parent.linkedDepartments).toContain('תברואה');
    expect(mergedCount).toBe(1);
  });

  it('שתי פניות על אותו אירוע (כתובת+נושא+יום) מקובצות לאחת', () => {
    const { tickets } = prepareTickets(all, new Date(2026, 7, 16));
    const tree = tickets.filter(t => t.address.includes('הדקל') && !t.groupedInto);
    expect(tree.length).toBe(1);
    expect(tree[0].groupCount).toBe(2);
  });
});

/**
 * הפורמט האמיתי של הייצוא (אומת 26.08 מול שלושה קבצים אמיתיים):
 * 19 עמודות, עמודת "אגף" מובנית, מדד SLA באחוזים. שני סוגי ייצוא -
 * קובץ יום (מסונן תאריך) וקובץ פתוחות (מסונן סטטוס).
 */
const DAY_FIXTURE = fs.readFileSync(
  path.join(process.cwd(), 'tests', 'fixtures', 'binaa-day-sample.csv'),
  'utf8'
);
const OPEN_FIXTURE = fs.readFileSync(
  path.join(process.cwd(), 'tests', 'fixtures', 'binaa-open-sample.csv'),
  'utf8'
);

describe('הפורמט החדש - אגף ו-SLA', () => {
  const day = parseTicketsCsv(DAY_FIXTURE);

  it('קורא את כל השורות של הפורמט החדש', () => {
    expect(day.length).toBe(12);
  });

  it('מנרמל את עמודת האגף - קידומת "אגף " יורדת', () => {
    expect(day.find(t => t.id === '700001').agaf).toBe('שפ"ע');
    expect(day.find(t => t.id === '700006').agaf).toBe('בטחון');
    expect(day.find(t => t.id === '700010').agaf).toBe('חינוך');
  });

  it('מפענח את מדד ה-SLA לאחוז מספרי, " -" הופך ל-null', () => {
    expect(day.find(t => t.id === '700002').slaPct).toBe(26.29);
    expect(day.find(t => t.id === '700004').slaPct).toBe(100);
    expect(day.find(t => t.id === '700003').slaPct).toBeNull();
  });

  it('הפורמט הישן (בלי עמודת אגף) ממשיך להיקרא', () => {
    const old = parseTicketsCsv(FIXTURE);
    expect(old.length).toBe(10);
    expect(old[0].agaf).toBe('');
    expect(old[0].slaPct).toBe(5);
  });
});

describe('isClosedStatus', () => {
  it('מזהה את משפחת הסטטוסים הסגורים', () => {
    expect(isClosedStatus('הטיפול הסתיים')).toBe(true);
    expect(isClosedStatus('תהליך הסתיים')).toBe(true);
    expect(isClosedStatus('וטרינריה - סטטוס סגור')).toBe(true);
    expect(isClosedStatus('לא יבוצע')).toBe(true);
    expect(isClosedStatus('פניה כפולה')).toBe(true);
  });

  it('סטטוסים פתוחים אינם סגורים', () => {
    expect(isClosedStatus('פניה נפתחה במערכת המוקד')).toBe(false);
    expect(isClosedStatus('בטיפול')).toBe(false);
    expect(isClosedStatus('מוחזרת עי הפונה')).toBe(false);
    expect(isClosedStatus('בתכנית עבודה')).toBe(false);
  });
});

describe('detectExportKind', () => {
  it('קובץ יום: יום אחד עם סטטוסים מעורבים', () => {
    expect(detectExportKind(parseTicketsCsv(DAY_FIXTURE))).toBe('day');
  });

  it('קובץ פתוחות: הרבה תאריכים, אפס סגורות', () => {
    expect(detectExportKind(parseTicketsCsv(OPEN_FIXTURE))).toBe('open');
  });
});

describe('computeAgafTable', () => {
  const day = parseTicketsCsv(DAY_FIXTURE);
  const open = parseTicketsCsv(OPEN_FIXTURE);
  const reportDate = new Date(2026, 7, 25);

  it('נפתחו וטופלו מקובץ היום - כולל פניות-בנות, לפי חלון הדוח', () => {
    const table = computeAgafTable(day, open, reportDate);
    expect(table['שפ"ע'].opened).toBe(6);
    expect(table['שפ"ע'].handled).toBe(3);
    expect(table['בטחון'].opened).toBe(4);
    expect(table['בטחון'].handled).toBe(2);
    expect(table['חינוך'].opened).toBe(2);
    expect(table['חינוך'].handled).toBe(0);
    expect(table['הנדסה'].opened).toBe(0);
    expect(table['הנדסה'].handled).toBe(0);
  });

  it('סך פתוחות וחורגות מקובץ הפתוחות - ספירה גולמית ו-SLA מעל 100', () => {
    const table = computeAgafTable(day, open, reportDate);
    expect(table['שפ"ע'].open_total).toBe(4);
    expect(table['שפ"ע'].overdue).toBe(1);
    expect(table['בטחון'].open_total).toBe(2);
    expect(table['בטחון'].overdue).toBe(1);
    expect(table['חינוך'].open_total).toBe(3);
    expect(table['חינוך'].overdue).toBe(2);
    expect(table['הנדסה'].open_total).toBe(1);
    expect(table['הנדסה'].overdue).toBe(1);
  });

  it('בלי קובץ פתוחות - העמודות שלו נשארות ריקות למילוי ידני', () => {
    const table = computeAgafTable(day, null, reportDate);
    expect(table['שפ"ע'].opened).toBe(6);
    expect(table['שפ"ע'].open_total).toBe('');
    expect(table['שפ"ע'].overdue).toBe('');
  });

  it('בלי קובץ יום - נפתחו/טופלו ריקות', () => {
    const table = computeAgafTable(null, open, reportDate);
    expect(table['חינוך'].opened).toBe('');
    expect(table['חינוך'].open_total).toBe(3);
  });
});

describe('stripPii', () => {
  it('מסיר שם וטלפון, משאיר את התוכן', () => {
    const t = parseTicketsCsv(FIXTURE)[0];
    const clean = stripPii(t);
    expect(clean.reporterName).toBeUndefined();
    expect(clean.reporterPhone).toBeUndefined();
    expect(clean.description).toBe(t.description);
  });
});
