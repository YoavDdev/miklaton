import { describe, it, expect } from 'vitest';
import {
  parseFilename,
  orderMigrations,
  checksum,
  planMigrations,
} from '../scripts/lib/migrations.js';

describe('parseFilename', () => {
  it('מפרק שם תקין לגרסה ולשם', () => {
    expect(parseFilename('0001_baseline.sql')).toEqual({
      version: 1,
      name: 'baseline',
      filename: '0001_baseline.sql',
    });
  });

  it('דוחה שמות שלא תואמים את התבנית', () => {
    expect(parseFilename('20260510_daily_operations.sql')?.version).toBe(20260510);
    expect(parseFilename('create_rbac_system.sql')).toBeNull();
    expect(parseFilename('0001_baseline.txt')).toBeNull();
    expect(parseFilename('README.md')).toBeNull();
  });
});

describe('orderMigrations', () => {
  it('ממיין לפי מספר ולא לפי אלפבית', () => {
    // אלפבית היה שם את 0010 לפני 0002
    const { migrations } = orderMigrations([
      '0010_tenth.sql',
      '0002_second.sql',
      '0001_first.sql',
    ]);
    expect(migrations.map((m) => m.version)).toEqual([1, 2, 10]);
  });

  it('מפריד קבצים שאינם מיגרציות במקום לבלוע אותם', () => {
    const { migrations, ignored } = orderMigrations(['0001_a.sql', 'README.md', 'notes.txt']);
    expect(migrations).toHaveLength(1);
    expect(ignored).toEqual(['README.md', 'notes.txt']);
  });

  it('זורק על גרסה כפולה - התקלה של 20260510', () => {
    expect(() => orderMigrations(['0003_daily_operations.sql', '0003_add_daily_operations.sql']))
      .toThrow(/כפולה 3/);
  });

  it('מחזיר רשימה ריקה בלי לקרוס כשאין מיגרציות', () => {
    expect(orderMigrations([]).migrations).toEqual([]);
  });
});

describe('checksum', () => {
  it('יציב לאותו תוכן ושונה לתוכן שונה', () => {
    expect(checksum('select 1;')).toBe(checksum('select 1;'));
    expect(checksum('select 1;')).not.toBe(checksum('select 2;'));
  });

  it('רגיש גם לשינוי רווח בודד', () => {
    expect(checksum('select 1;')).not.toBe(checksum('select  1;'));
  });
});

describe('planMigrations', () => {
  const migration = (version, sql) => ({
    version,
    name: `m${version}`,
    filename: `000${version}_m${version}.sql`,
    sql,
  });

  it('מריץ הכל כשאין שום דבר מוחל', () => {
    const available = [migration(1, 'a'), migration(2, 'b')];
    const plan = planMigrations(available, []);
    expect(plan.pending.map((m) => m.version)).toEqual([1, 2]);
    expect(plan.changed).toEqual([]);
    expect(plan.missing).toEqual([]);
  });

  it('מדלג על מה שכבר הוחל', () => {
    const available = [migration(1, 'a'), migration(2, 'b')];
    const plan = planMigrations(available, [{ version: 1, checksum: checksum('a') }]);
    expect(plan.pending.map((m) => m.version)).toEqual([2]);
  });

  it('לא מריץ כלום כשהכל מעודכן', () => {
    const available = [migration(1, 'a')];
    const plan = planMigrations(available, [{ version: 1, checksum: checksum('a') }]);
    expect(plan.pending).toEqual([]);
    expect(plan.changed).toEqual([]);
  });

  it('מסמן מיגרציה שנערכה אחרי שכבר הוחלה', () => {
    const available = [migration(1, 'a שונה')];
    const plan = planMigrations(available, [{ version: 1, checksum: checksum('a') }]);
    expect(plan.changed.map((m) => m.version)).toEqual([1]);
    expect(plan.pending).toEqual([]);
  });

  it('מסמן מיגרציה שרשומה כמוחלת אבל הקובץ נעלם', () => {
    const plan = planMigrations([migration(1, 'a')], [
      { version: 1, checksum: checksum('a') },
      { version: 2, checksum: 'whatever' },
    ]);
    expect(plan.missing).toEqual([2]);
  });

  it('מזהה גם עריכה בדיעבד וגם ממתינה באותה הרצה', () => {
    const available = [migration(1, 'a שונה'), migration(2, 'b')];
    const plan = planMigrations(available, [{ version: 1, checksum: checksum('a') }]);
    expect(plan.changed.map((m) => m.version)).toEqual([1]);
    expect(plan.pending.map((m) => m.version)).toEqual([2]);
  });
});
