import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { analyzeSheet, parseScheduleSheet } from '@/lib/schedule-excel-parser';

/**
 * YOA-35: הפרסר רץ כאן מול עותק מותמם של הקובץ האמיתי של מנהל הביטחון -
 * אותו מבנה, אותם דפוסי תוכן (הערות חופשיות, תיקוני שעות, טבלת סטטוס ימנית),
 * שמות בדויים. הכשלים שנבדקים כאן נמצאו בקובץ האמיתי בפרודקשן.
 */

const FIXTURE = path.join(process.cwd(), 'tests', 'fixtures', 'security-roster-sample.xlsx');

// רשימת העובדים כפי שהיא בעותק המותמם (מקבילה ל-security_staff בפרודקשן)
const STAFF = [
  { id: 's1', full_name: 'משה כהן' },
  { id: 's2', full_name: 'רונית ברקוביץ' },
  { id: 's3', full_name: 'גיל אזולאי' },
  { id: 's4', full_name: 'שירה לביא' },
  { id: 's5', full_name: 'רבקה אלבז' },
  { id: 's6', full_name: 'בוריס ברגר' },
  { id: 's7', full_name: 'ורד פרידמן' },
  { id: 's8', full_name: 'אברהם נחום' },
  { id: 's9', full_name: 'עומר פרץ' },
];

function sheetRows(name) {
  const wb = XLSX.read(fs.readFileSync(FIXTURE), { type: 'buffer' });
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 });
}

describe('זיהוי גיליונות ותאריכים', () => {
  it('כל גיליון בקובץ מזוהה כסידור, כולל שם גיליון בלי שנה ("16.8-22.8")', () => {
    for (const name of ['16.8-22.8', '2.8.26-8.8.26', '24.5.26-30.5.26']) {
      const info = analyzeSheet(sheetRows(name));
      expect(info.isSchedule, name).toBe(true);
      expect(info.weekSunday, name).not.toBeNull();
    }
  });

  it('התאריך נקרא משורת הסריאלים ולא משם הגיליון', () => {
    const info = analyzeSheet(sheetRows('16.8-22.8'));
    expect(info.weekSunday.toISOString().slice(0, 10)).toBe('2026-08-16');
  });
});

describe('גיליון שבוע מלא ותקין', () => {
  const parsed = parseScheduleSheet(sheetRows('16.8-22.8'), STAFF, []);

  it('כל השיבוצים חולצו וכל השמות זוהו מול רשימת העובדים', () => {
    expect(parsed.entries.length).toBe(42);
    expect(parsed.entries.every(e => e.staff_id)).toBe(true);
  });

  it('תיקון שעות בתא ("07:00-16:00" מתחת לשם) הופך לשעות בפועל, לא לעובד', () => {
    // עד YOA-37 זה נשמר כהערת טקסט; עכשיו זה שדה אמיתי על השיבוץ.
    const withOverride = parsed.entries.filter(e => e.actual_end === '16:00');
    expect(withOverride.length).toBeGreaterThan(0);
    expect(parsed.entries.some(e => e.staff_name.includes('07:00'))).toBe(false);
  });

  it('רכב בסוגריים נשמר כהערה', () => {
    expect(parsed.entries.some(e => e.notes?.includes('אופנוע'))).toBe(true);
  });

  it('"חסר פקח" מדולג ומדווח, לא הופך לעובד', () => {
    expect(parsed.entries.some(e => e.staff_name.includes('חסר'))).toBe(false);
    expect(parsed.skippedTokens.some(t => t.includes('חסר פקח'))).toBe(true);
  });
});

describe('שבוע שמנוהל רק בטבלת הסטטוס הימנית', () => {
  it('טבלת המשמרות ריקה => אפס שיבוצים, בלי זבל מהטבלה הימנית', () => {
    // בגיליון הזה עמודות המשמרות ריקות והסידור חי בעמודות K-S
    // (סטטוס פר עובד). הפרסר לא קורא אותן - אסור שהן ידלפו כשיבוצים.
    const parsed = parseScheduleSheet(sheetRows('2.8.26-8.8.26'), STAFF, []);
    expect(parsed.entries.length).toBe(0);
  });
});

describe('שעות בפועל בתא הן הנתון האמיתי (YOA-37)', () => {
  // כשאריאל כותב שעות בתא של עובד - אלה השעות הנכונות; שורת המשמרת היא
  // תבנית בלבד. השעות עוברות לשדות actual_start/actual_end, לא להערה.
  const parsed = parseScheduleSheet(sheetRows('16.8-22.8'), STAFF, []);

  it('טווח מלא בתא ("12:00-22:00" מתחת לשם) הופך לשעות בפועל', () => {
    // רבקה, יום שישי, בשורת המשמרת 10:00-18:00 - עובדת בפועל 12:00-22:00
    const entry = parsed.entries.find(
      e => e.staff_id === 's5' && e.day_of_week === 5 && e.shift_start === '10:00'
    );
    expect(entry.actual_start).toBe('12:00');
    expect(entry.actual_end).toBe('22:00');
  });

  it('השעות אינן משוכפלות גם כהערה', () => {
    const entry = parsed.entries.find(
      e => e.staff_id === 's5' && e.day_of_week === 5 && e.shift_start === '10:00'
    );
    expect(entry.notes || '').not.toContain('12:00-22:00');
    expect(entry.notes).toContain('סיאט'); // הרכב נשאר הערה
  });

  it('משמרת הלילה השיטתית: השורה אומרת 18:00-03:00, כולם בפועל 19:00-04:00', () => {
    const night = parsed.entries.filter(
      e => e.category === 'שיטור' && e.shift_start === '18:00' && e.actual_start
    );
    expect(night.length).toBeGreaterThanOrEqual(5);
    expect(night.every(e => e.actual_start === '19:00' || e.actual_start === '20:00')).toBe(true);
  });

  it('"עד 11:00" קובע רק שעת סיום; ההתחלה יורשת מהמשמרת (null)', () => {
    // רונית, יום ראשון, 07:00-15:00 - "עד 11:00"
    const entry = parsed.entries.find(
      e => e.staff_id === 's2' && e.day_of_week === 0 && e.shift_start === '07:00'
    );
    expect(entry.actual_end).toBe('11:00');
    expect(entry.actual_start).toBeNull();
    expect(entry.notes || '').not.toContain('עד');
  });

  it('שיבוץ בלי שעות בתא נשאר עם null - יורש את שעות המשמרת', () => {
    const plain = parsed.entries.find(e => !e.actual_start && !e.actual_end);
    expect(plain).toBeTruthy();
    expect(plain.actual_start).toBeNull();
    expect(plain.actual_end).toBeNull();
  });

  it('"מ-14:00" קובע רק שעת התחלה', () => {
    const rows = [
      ['משמרת', 'מחלקה', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'],
      ['07:00-15:00', 'פיקוח', 'משה מ-14:00'],
    ];
    const { entries } = parseScheduleSheet(rows, STAFF, []);
    expect(entries[0].actual_start).toBe('14:00');
    expect(entries[0].actual_end).toBeNull();
  });

  it('"עד 11" בלי דקות מנורמל ל-11:00', () => {
    const rows = [
      ['משמרת', 'מחלקה', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'],
      ['07:00-15:00', 'פיקוח', 'משה עד 11'],
    ];
    const { entries } = parseScheduleSheet(rows, STAFF, []);
    expect(entries[0].actual_end).toBe('11:00');
  });
});

describe('שורות שאינן שמות אינן הופכות לעובדים (YOA-35)', () => {
  const junky = parseScheduleSheet(sheetRows('24.5.26-30.5.26'), STAFF, []);
  const junky2 = parseScheduleSheet(sheetRows('17.5.26-23.5.26'), STAFF, []);
  const allNames = [...junky.entries, ...junky2.entries].map(e => e.staff_name);

  it('שעה בודדת ("15:00") אינה עובד', () => {
    expect(allNames.filter(n => /\d/.test(n))).toEqual([]);
  });

  it('הערות חופשיות ("הילולה משעה 21:00", "משה ירד מהסידור") אינן עובדים', () => {
    expect(allNames.some(n => n.includes('הילולה'))).toBe(false);
    expect(allNames.some(n => n.includes('ירד'))).toBe(false);
    expect(allNames.some(n => n.includes('במקום'))).toBe(false);
  });

  it('מה שסונן מדווח ב-skippedTokens כדי שהמנהל יראה מה לא יובא', () => {
    expect(junky.skippedTokens.some(t => t.includes('הילולה'))).toBe(true);
  });

  it('שם לא מוכר אך סביר ("טליה") עדיין מיובא כשם ידני', () => {
    const manual = [...junky.manualNames, ...junky2.manualNames];
    expect(manual).toContain('טליה');
  });

  it('שם שזוהה ברשימת העובדים תמיד מיובא, גם עם הערה צמודה', () => {
    // "רונית (קשקאי)" - הסוגריים הופכות להערה והשם מזוהה
    expect(junky.entries.some(e => e.staff_id === 's2')).toBe(true);
  });
});
