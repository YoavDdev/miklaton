import { describe, it, expect, vi } from 'vitest';
import { signScheduleUploadToken } from '@/lib/auth';
import { makeRequest } from './helpers/request';

/**
 * YOA-36: זרימת העבודה של מנהל הביטחון היא העלאה מחדש של כל הקובץ בכל
 * שינוי - וקרה שקובץ ישן דרס סידור עדכני בשקט. ה-GET של מסלול ההעלאה
 * מחזיר עכשיו, לפי בקשה, מה כבר קיים בשבוע היעד - כדי שהתצוגה המקדימה
 * תזהיר לפני שדורסים.
 */
const { state, chain } = vi.hoisted(() => {
  const state = { weeklyRows: [] };
  function chain(table) {
    return new Proxy(function () {}, {
      get(_target, prop) {
        if (prop === 'then') {
          const result =
            table === 'security_weekly_schedule'
              ? { data: state.weeklyRows, error: null }
              : { data: [], error: null };
          return (resolve) => resolve(result);
        }
        if (prop === Symbol.toPrimitive || prop === 'toJSON') return undefined;
        return () => chain(table);
      },
      apply() {
        return chain(table);
      },
    });
  }
  return { state, chain };
});

vi.mock('@/lib/supabase-server', () => ({
  supabase: { from: (table) => chain(table) },
}));

const DEPT = '11111111-1111-4111-8111-111111111111';
const url = (extra = '') =>
  `/api/schedule-upload?departmentId=${DEPT}&t=${signScheduleUploadToken(DEPT)}${extra}`;

describe('אזהרת דריסה — מה כבר קיים בשבוע היעד', () => {
  it('עם week_start מוחזר מספר השיבוצים הקיימים ומתי עודכנו לאחרונה', async () => {
    state.weeklyRows = [
      { created_at: '2026-08-17T09:00:00+00:00' },
      { created_at: '2026-08-18T14:32:00+00:00' },
    ];
    const mod = await import('@/app/api/schedule-upload/route');
    const res = await mod.GET(makeRequest(url('&week_start=2026-08-16')));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.existingWeek.count).toBe(2);
    expect(body.existingWeek.last_updated).toBe('2026-08-18T14:32:00+00:00');
  });

  it('שבוע ריק מוחזר כאפס, לא כשגיאה', async () => {
    state.weeklyRows = [];
    const mod = await import('@/app/api/schedule-upload/route');
    const res = await mod.GET(makeRequest(url('&week_start=2026-08-23')));
    const body = await res.json();
    expect(body.existingWeek).toEqual({ count: 0, last_updated: null });
  });

  it('בלי week_start ההתנהגות הישנה נשמרת - אין existingWeek', async () => {
    const mod = await import('@/app/api/schedule-upload/route');
    const res = await mod.GET(makeRequest(url()));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.existingWeek).toBeUndefined();
  });
});
