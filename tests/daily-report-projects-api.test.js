import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signToken } from '@/lib/auth';
import { makeRequest } from './helpers/request';

/**
 * YOA-42 שלב 3: עבודות בעיר - רשימה מנוהלת. אותה סמכות משמרת כמו
 * הדוח עצמו; הרשות נלקחת מהפרופיל בשרת, וקלט תאריך ישראלי נשמר
 * כ-date בעוד טקסט חופשי ("ספטמבר") נשמר כהערכה.
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
        return (...args) => {
          if (prop === 'insert') calls.push({ table, op: 'insert', rows: args[0] });
          if (prop === 'update') calls.push({ table, op: 'update', rows: args[0] });
          if (prop === 'eq') calls.push({ table, op: 'eq', args });
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
  makeRequest('/api/daily-report/projects', {
    ...options,
    cookies: { 'auth-token': signToken({ userId: 'u1', role, name: 'בודקת' }) },
  });

describe('/api/daily-report/projects — הרשאות', () => {
  it.each(['GET', 'POST', 'PATCH'])('%s חסום למוקדן', async (method) => {
    const mod = await import('@/app/api/daily-report/projects/route');
    const options = method === 'GET' ? { method } : { method, body: {} };
    const res = await mod[method](asRole('operator', options));
    expect(res.status).toBe(403);
  });

  it('GET עובר לאחמ"ש', async () => {
    const mod = await import('@/app/api/daily-report/projects/route');
    expect((await mod.GET(asRole('shift_supervisor'))).status).toBe(200);
  });
});

describe('POST — עבודה חדשה', () => {
  beforeEach(() => { calls.length = 0; });

  it('תאריך ישראלי נשמר כ-date, טקסט חופשי כהערכה, והרשות מהשרת', async () => {
    const mod = await import('@/app/api/daily-report/projects/route');
    const res = await mod.POST(
      asRole('shift_supervisor', {
        method: 'POST',
        body: { description: 'מובל נורדאו', owner: 'חכ"ל', start: '02.08.2026', end: 'ספטמבר' },
      })
    );
    expect(res.status).toBe(200);
    const insert = calls.find(c => c.op === 'insert' && c.table === 'report_projects');
    expect(insert.rows.description).toBe('מובל נורדאו');
    expect(insert.rows.start_date).toBe('2026-08-02');
    expect(insert.rows.end_date).toBeNull();
    expect(insert.rows.end_date_approx).toBe('ספטמבר');
    expect(insert.rows.municipality_id).toBe('muni-1');
  });

  it('end בתאריך מלא נשמר כ-end_date', async () => {
    const mod = await import('@/app/api/daily-report/projects/route');
    await mod.POST(
      asRole('shift_supervisor', {
        method: 'POST',
        body: { description: 'עבודות לילה', end: '20.08.2026' },
      })
    );
    const insert = calls.find(c => c.op === 'insert');
    expect(insert.rows.end_date).toBe('2026-08-20');
    expect(insert.rows.end_date_approx).toBeNull();
  });

  it('בלי תיאור - 400', async () => {
    const mod = await import('@/app/api/daily-report/projects/route');
    const res = await mod.POST(asRole('shift_supervisor', { method: 'POST', body: { owner: 'x' } }));
    expect(res.status).toBe(400);
  });
});

describe('PATCH — עדכון וסגירה', () => {
  beforeEach(() => { calls.length = 0; });

  it('סימון הסתיימה מעדכן status לפי id', async () => {
    const mod = await import('@/app/api/daily-report/projects/route');
    const res = await mod.PATCH(
      asRole('shift_supervisor', { method: 'PATCH', body: { id: 'p1', status: 'ended' } })
    );
    expect(res.status).toBe(200);
    const update = calls.find(c => c.op === 'update');
    expect(update.rows.status).toBe('ended');
    expect(calls.some(c => c.op === 'eq' && c.args[0] === 'id' && c.args[1] === 'p1')).toBe(true);
  });

  it('הארכת תאריך מנקה הערכה ישנה', async () => {
    const mod = await import('@/app/api/daily-report/projects/route');
    await mod.PATCH(
      asRole('shift_supervisor', { method: 'PATCH', body: { id: 'p1', end: '30.09.2026' } })
    );
    const update = calls.find(c => c.op === 'update');
    expect(update.rows.end_date).toBe('2026-09-30');
    expect(update.rows.end_date_approx).toBeNull();
  });

  it('בלי id - 400', async () => {
    const mod = await import('@/app/api/daily-report/projects/route');
    const res = await mod.PATCH(asRole('shift_supervisor', { method: 'PATCH', body: { status: 'ended' } }));
    expect(res.status).toBe(400);
  });
});
