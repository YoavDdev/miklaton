import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signToken } from '@/lib/auth';
import { makeRequest } from './helpers/request';

/**
 * YOA-42 (docs/16): הפקת דוח הסיכום היומי היא סמכות משמרת - אחמ"ש
 * ומנהלת המוקד בלבד, כמו ההודעות ומצב החירום. השמירה נושאת את זהות
 * המפיק מהטוקן ואת הרשות מהפרופיל בשרת, לא מהבקשה.
 */
const { calls, chain } = vi.hoisted(() => {
  const calls = [];
  function chain(table) {
    return new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === 'then') {
          const result =
            table === 'user_profiles'
              ? { data: { municipality_id: 'muni-1' }, error: null }
              : { data: [], error: null };
          return (resolve) => resolve(result);
        }
        if (prop === Symbol.toPrimitive || prop === 'toJSON') return undefined;
        return (arg) => {
          if (prop === 'insert') calls.push({ table, rows: arg });
          return chain(table);
        };
      },
      apply() { return chain(table); },
    });
  }
  return { calls, chain };
});

vi.mock('@/lib/supabase-server', () => ({ supabase: { from: (t) => chain(t) } }));

const asRole = (role, options = {}) =>
  makeRequest('/api/daily-report', {
    ...options,
    cookies: { 'auth-token': signToken({ userId: 'u1', role, name: 'אחמ"שית בודקת' }) },
  });

describe('/api/daily-report — הרשאות', () => {
  it.each(['GET', 'POST'])('%s חסום למוקדן ולמנהל מכלול', async (method) => {
    const mod = await import('@/app/api/daily-report/route');
    for (const role of ['operator', 'sector_manager']) {
      const options = method === 'POST' ? { method, body: {} } : { method };
      const res = await mod[method](asRole(role, options));
      expect(res.status, `${role} ${method}`).toBe(403);
    }
  });

  it.each(['shift_supervisor', 'call_center_manager'])('%s עובר', async (role) => {
    const mod = await import('@/app/api/daily-report/route');
    const res = await mod.GET(asRole(role));
    expect(res.status).toBe(200);
  });
});

describe('POST — שמירת דוח', () => {
  beforeEach(() => { calls.length = 0; });

  it('שומר snapshot עם זהות המפיק והרשות מהשרת', async () => {
    const mod = await import('@/app/api/daily-report/route');
    const res = await mod.POST(
      asRole('shift_supervisor', {
        method: 'POST',
        body: {
          report_date: '2026-08-18',
          source_file_name: 'tickets.csv',
          snapshot: { ticket_ids: ['1'], exceptional: [] },
        },
      })
    );
    expect(res.status).toBe(200);
    const insert = calls.find(c => c.table === 'daily_reports');
    expect(insert.rows.report_date).toBe('2026-08-18');
    expect(insert.rows.produced_by).toBe('u1');
    expect(insert.rows.municipality_id).toBe('muni-1');
    expect(insert.rows.snapshot.ticket_ids).toEqual(['1']);
  });

  it('דוחה גוף בלי snapshot או תאריך', async () => {
    const mod = await import('@/app/api/daily-report/route');
    const res = await mod.POST(
      asRole('shift_supervisor', { method: 'POST', body: { report_date: '2026-08-18' } })
    );
    expect(res.status).toBe(400);
  });
});
