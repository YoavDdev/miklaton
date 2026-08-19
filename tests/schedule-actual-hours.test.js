import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signToken, signScheduleUploadToken } from '@/lib/auth';
import { makeRequest } from './helpers/request';

/**
 * YOA-37: שעות בפועל שנכתבו בתא של עובד חייבות לשרוד את כל הדרך מהפרסר
 * ועד השורה ב-DB, בשני מסלולי ההעלאה (הקישור החתום והמסלול המאומת).
 * שני הראוטים בנויים להישאר זהים - הבדיקה מעגנת את זה לשדות החדשים.
 */
const { inserts, chain } = vi.hoisted(() => {
  const inserts = [];
  function chain(table) {
    return new Proxy(function () {}, {
      get(_target, prop) {
        if (prop === 'then') {
          const result =
            table === 'security_shifts'
              ? { data: [{ id: 'sh1', category: 'פיקוח', start_time: '10:00:00', end_time: '18:00:00' }], error: null }
              : { data: [], error: null };
          return (resolve) => resolve(result);
        }
        if (prop === Symbol.toPrimitive || prop === 'toJSON') return undefined;
        return (arg) => {
          if (prop === 'insert') inserts.push({ table, rows: arg });
          return chain(table);
        };
      },
      apply() {
        return chain(table);
      },
    });
  }
  return { inserts, chain };
});

vi.mock('@/lib/supabase-server', () => ({
  supabase: { from: (table) => chain(table) },
}));

const DEPT = '11111111-1111-4111-8111-111111111111';

describe('שעות בפועל מגיעות עד ה-DB', () => {
  beforeEach(() => {
    inserts.length = 0;
  });

  it('מסלול הקישור החתום (/api/schedule-upload) שומר actual_start/actual_end', async () => {
    const mod = await import('@/app/api/schedule-upload/route');
    const res = await mod.POST(
      makeRequest('/api/schedule-upload', {
        method: 'POST',
        body: {
          department_id: DEPT,
          token: signScheduleUploadToken(DEPT),
          week_start: '2026-08-16',
          newShifts: [],
          entries: [
            {
              shift_key: 'פיקוח|10:00|18:00',
              staff_id: 's5',
              day_of_week: 5,
              actual_start: '12:00',
              actual_end: '22:00',
              notes: 'סיאט',
            },
          ],
        },
      })
    );
    expect(res.status).toBe(200);
    const insert = inserts.find((i) => i.table === 'security_weekly_schedule');
    expect(insert.rows[0].actual_start).toBe('12:00');
    expect(insert.rows[0].actual_end).toBe('22:00');
  });

  it('המסלול המאומת (/api/security-schedule/bulk-insert) שומר actual_start/actual_end', async () => {
    const mod = await import('@/app/api/security-schedule/bulk-insert/route');
    const res = await mod.POST(
      makeRequest('/api/security-schedule/bulk-insert', {
        method: 'POST',
        cookies: {
          'auth-token': signToken({ userId: 'u1', role: 'call_center_manager', name: 'בודקת' }),
        },
        body: {
          department_id: DEPT,
          week_start: '2026-08-16',
          entries: [
            {
              shift_id: 'sh1',
              staff_id: 's5',
              day_of_week: 5,
              actual_start: '19:00',
              actual_end: '04:00',
            },
          ],
        },
      })
    );
    expect(res.status).toBe(200);
    const insert = inserts.find((i) => i.table === 'security_weekly_schedule');
    expect(insert.rows[0].actual_start).toBe('19:00');
    expect(insert.rows[0].actual_end).toBe('04:00');
  });

  it('שיבוץ בלי שעות בפועל נשמר עם null, לא עם מחרוזת ריקה', async () => {
    const mod = await import('@/app/api/schedule-upload/route');
    await mod.POST(
      makeRequest('/api/schedule-upload', {
        method: 'POST',
        body: {
          department_id: DEPT,
          token: signScheduleUploadToken(DEPT),
          week_start: '2026-08-16',
          newShifts: [],
          entries: [{ shift_key: 'פיקוח|10:00|18:00', staff_id: 's1', day_of_week: 0 }],
        },
      })
    );
    const insert = inserts.find((i) => i.table === 'security_weekly_schedule');
    expect(insert.rows[0].actual_start).toBeNull();
    expect(insert.rows[0].actual_end).toBeNull();
  });
});
