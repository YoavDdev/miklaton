import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { parseTicketsCsv, reportWindow, prepareTickets, stripPii } from '@/lib/binaa-tickets';

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

describe('stripPii', () => {
  it('מסיר שם וטלפון, משאיר את התוכן', () => {
    const t = parseTicketsCsv(FIXTURE)[0];
    const clean = stripPii(t);
    expect(clean.reporterName).toBeUndefined();
    expect(clean.reporterPhone).toBeUndefined();
    expect(clean.description).toBe(t.description);
  });
});
