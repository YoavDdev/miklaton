import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signToken, signScheduleUploadToken } from '@/lib/auth';
import { makeRequest } from './helpers/request';

/**
 * YOA-38: חופשות מהטבלה הימנית של הקובץ מגיעות לטבלת security_staff_leave.
 * הייבוא מחליף רק רשומות שמקורן באקסל (source='excel') - רשומות שהוזנו
 * ידנית במסך לא נמחקות. שבוע שכל הסידור שלו חי בטבלה הימנית מייבא חופשות
 * בלי למחוק את סידור המשמרות הקיים.
 */
const { calls, chain } = vi.hoisted(() => {
  const calls = [];
  function chain(table) {
    return new Proxy(function () {}, {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve) => resolve({ data: [], error: null });
        }
        if (prop === Symbol.toPrimitive || prop === 'toJSON') return undefined;
        return (arg) => {
          if (prop === 'insert') calls.push({ table, op: 'insert', rows: arg });
          if (prop === 'delete') calls.push({ table, op: 'delete' });
          return chain(table);
        };
      },
      apply() {
        return chain(table);
      },
    });
  }
  return { calls, chain };
});

vi.mock('@/lib/supabase-server', () => ({
  supabase: { from: (table) => chain(table) },
}));

const DEPT = '11111111-1111-4111-8111-111111111111';
const LEAVES = [
  { staff_id: 's9', start_date: '2026-08-16', end_date: '2026-08-22', reason: 'מחלה' },
  { staff_id: null, staff_name: 'לא מזוהה', start_date: '2026-08-17', end_date: '2026-08-17', reason: 'חופש' },
];

const publicBody = (entries, leaves) => ({
  department_id: DEPT,
  token: signScheduleUploadToken(DEPT),
  week_start: '2026-08-16',
  newShifts: [],
  entries,
  leaves,
});

describe('ייבוא חופשות מהקובץ', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it('מסלול הקישור החתום שומר חופשות עם source=excel, ומדלג על שם לא מזוהה', async () => {
    const mod = await import('@/app/api/schedule-upload/route');
    const res = await mod.POST(
      makeRequest('/api/schedule-upload', { method: 'POST', body: publicBody([], LEAVES) })
    );
    expect(res.status).toBe(200);
    const insert = calls.find((c) => c.table === 'security_staff_leave' && c.op === 'insert');
    expect(insert.rows).toHaveLength(1);
    expect(insert.rows[0]).toMatchObject({
      staff_id: 's9',
      start_date: '2026-08-16',
      end_date: '2026-08-22',
      reason: 'מחלה',
      source: 'excel',
    });
  });

  it('הייבוא מוחק רק רשומות excel קודמות, ולא נוגע בסידור כשאין שיבוצים', async () => {
    const mod = await import('@/app/api/schedule-upload/route');
    await mod.POST(
      makeRequest('/api/schedule-upload', { method: 'POST', body: publicBody([], LEAVES) })
    );
    expect(calls.some((c) => c.table === 'security_staff_leave' && c.op === 'delete')).toBe(true);
    expect(calls.some((c) => c.table === 'security_weekly_schedule' && c.op === 'delete')).toBe(false);
  });

  it('בלי leaves ההתנהגות הישנה נשמרת - אין נגיעה בטבלת החופשות', async () => {
    const mod = await import('@/app/api/schedule-upload/route');
    await mod.POST(
      makeRequest('/api/schedule-upload', { method: 'POST', body: publicBody([], undefined) })
    );
    expect(calls.some((c) => c.table === 'security_staff_leave')).toBe(false);
  });

  it('המסלול המאומת (bulk-insert) שומר חופשות באותה צורה', async () => {
    const mod = await import('@/app/api/security-schedule/bulk-insert/route');
    const res = await mod.POST(
      makeRequest('/api/security-schedule/bulk-insert', {
        method: 'POST',
        cookies: {
          'auth-token': signToken({ userId: 'u1', role: 'call_center_manager', name: 'בודקת' }),
        },
        body: { department_id: DEPT, week_start: '2026-08-16', entries: [], leaves: LEAVES },
      })
    );
    expect(res.status).toBe(200);
    const insert = calls.find((c) => c.table === 'security_staff_leave' && c.op === 'insert');
    expect(insert.rows[0]).toMatchObject({ staff_id: 's9', source: 'excel' });
  });
});
