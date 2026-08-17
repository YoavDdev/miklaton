import { describe, it, expect } from 'vitest';
import {
  parseFilename,
  findSilentlySkipped,
  findDuplicateVersions,
  orderMigrations,
  checksum,
} from '../scripts/lib/migrations.js';

// שמות אמיתיים מהארכיון - אלה המקרים שבאמת קרו בפרויקט הזה.
const REAL_SKIPPED = [
  '20260817a_temp_password_nullable.sql',
  '20260817b_drop_temp_password_plain.sql',
  '20260817c_inspection_reports.sql',
  'create_oncall_system.sql',
  'create_rbac_system.sql',
  'create_war_mode.sql',
];

describe('parseFilename', () => {
  it('מקבל את התבנית שה-CLI מקבל', () => {
    expect(parseFilename('20260818120000_add_thing.sql')).toEqual({
      version: '20260818120000',
      name: 'add_thing',
      filename: '20260818120000_add_thing.sql',
    });
  });

  it('דוחה בדיוק את מה שה-CLI דוחה', () => {
    for (const f of REAL_SKIPPED) expect(parseFilename(f), f).toBeNull();
  });

  it('דוחה קבצים שאינם sql', () => {
    expect(parseFilename('README.md')).toBeNull();
    expect(parseFilename('20260818_note.txt')).toBeNull();
  });
});

describe('findSilentlySkipped', () => {
  it('מוצא את ששת הקבצים שה-CLI דילג עליהם בפועל', () => {
    const found = findSilentlySkipped([...REAL_SKIPPED, '20260326_add_must_change_password.sql']);
    expect(found.sort()).toEqual([...REAL_SKIPPED].sort());
  });

  it('לא מתלונן על README או קבצים שאינם sql', () => {
    expect(findSilentlySkipped(['README.md', 'notes.txt'])).toEqual([]);
  });

  it('שקט כשהכול תקין', () => {
    expect(findSilentlySkipped(['20260818120000_ok.sql'])).toEqual([]);
  });
});

describe('findDuplicateVersions', () => {
  it('תופס את ההתנגשות של 20260510 שה-CLI בלע בשקט', () => {
    const dupes = findDuplicateVersions([
      '20260510_daily_operations.sql',
      '20260510_add_daily_operations.sql',
      '20260714_panic_buttons.sql',
    ]);
    expect(dupes).toHaveLength(1);
    expect(dupes[0].version).toBe('20260510');
    expect(dupes[0].files).toEqual([
      '20260510_add_daily_operations.sql',
      '20260510_daily_operations.sql',
    ]);
  });

  it('תופס את ששת הקבצים של 20260511', () => {
    const files = [
      '20260511_call_categories.sql',
      '20260511_enhance_call_categories.sql',
      '20260511_enhance_oncall_contacts.sql',
      '20260511_enhance_oncall_shifts.sql',
      '20260511_priority_contacts.sql',
      '20260511_remove_oncall_tables.sql',
    ];
    const dupes = findDuplicateVersions(files);
    expect(dupes[0].files).toHaveLength(6);
  });

  it('שקט כשכל הגרסאות ייחודיות', () => {
    expect(findDuplicateVersions(['20260818120000_a.sql', '20260818120001_b.sql'])).toEqual([]);
  });

  it('מתעלם מקבצים שממילא ידולגו', () => {
    expect(findDuplicateVersions(['create_a.sql', 'create_b.sql'])).toEqual([]);
  });
});

describe('orderMigrations', () => {
  it('ממיין לפי חותמת זמן', () => {
    const ordered = orderMigrations([
      '20260818120002_third.sql',
      '20260818120000_first.sql',
      '20260818120001_second.sql',
    ]);
    expect(ordered.map((m) => m.name)).toEqual(['first', 'second', 'third']);
  });

  it('משמיט קבצים שאינם מיגרציות', () => {
    expect(orderMigrations(['README.md', '20260818120000_a.sql'])).toHaveLength(1);
  });

  it('לא קורס על רשימה ריקה', () => {
    expect(orderMigrations([])).toEqual([]);
  });
});

describe('checksum', () => {
  it('יציב לאותו תוכן ושונה לתוכן שונה', () => {
    expect(checksum('select 1;')).toBe(checksum('select 1;'));
    expect(checksum('select 1;')).not.toBe(checksum('select 2;'));
    expect(checksum('select 1;')).not.toBe(checksum('select  1;'));
  });
});
