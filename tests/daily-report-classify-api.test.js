import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signToken } from '@/lib/auth';
import { makeRequest } from './helpers/request';

/**
 * YOA-42 שלב 2: ראוט הסיווג. החוזים: PII לא יוצא ל-OpenAI, כשל AI
 * מחזיר שגיאה ברורה (הדוח ממשיך ידנית), והכללים נטענים מההגדרות.
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
              : table === 'daily_report_settings'
                ? { data: { classification_rules: 'כלל בדיקה: עמודים - סכנה', ai_model: 'gpt-4o-mini' }, error: null }
                : { data: [], error: null };
          return (resolve) => resolve(result);
        }
        if (prop === Symbol.toPrimitive || prop === 'toJSON') return undefined;
        return (...args) => {
          if (prop === 'upsert') calls.push({ table, op: 'upsert', rows: args[0] });
          return chain(table);
        };
      },
      apply() { return chain(table); },
    });
  }
  return { calls, chain };
});

vi.mock('@/lib/supabase-server', () => ({ supabase: { from: (t) => chain(t) } }));

const TICKETS = [
  {
    id: '508484',
    openedAt: '2026-08-26T09:49:00.000Z',
    department: 'חשמל ותאורה',
    subject: 'עמוד תאורה נוטה',
    description: 'עמוד תאורה עקום ליד הפטאנק',
    address: 'רם כהן 5',
    lastTreatment: 'בטיפול',
    reporterName: 'גיל סימנהויז',
    reporterPhone: '052-3039955',
  },
];

const asRole = (role, options = {}) =>
  makeRequest('/api/daily-report/classify', {
    ...options,
    cookies: { 'auth-token': signToken({ userId: 'u1', role, name: 'בודקת' }) },
  });

describe('/api/daily-report/classify', () => {
  const realFetch = global.fetch;
  beforeEach(() => {
    calls.length = 0;
    process.env.OPENAI_API_KEY = 'test-key';
    vi.resetModules();
  });
  afterEach(() => { global.fetch = realFetch; });

  it('POST חסום למוקדן', async () => {
    const mod = await import('@/app/api/daily-report/classify/route');
    expect((await mod.POST(asRole('operator', { method: 'POST', body: {} }))).status).toBe(403);
  });

  it('מסווג - וה-PII לא יוצא ל-OpenAI, הכללים מההגדרות כן', async () => {
    let outbound = null;
    global.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      outbound = opts.body;
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ tickets: [{ id: '508484', category: 'danger', reason: 'מפגע מסוכן' }] }) } }],
        }),
      };
    });
    const mod = await import('@/app/api/daily-report/classify/route');
    const res = await mod.POST(asRole('shift_supervisor', { method: 'POST', body: { tickets: TICKETS } }));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toEqual([{ id: '508484', category: 'danger', reason: 'מפגע מסוכן' }]);
    expect(outbound).toContain('508484');
    expect(outbound).toContain('כלל בדיקה: עמודים - סכנה');
    expect(outbound).not.toContain('גיל סימנהויז');
    expect(outbound).not.toContain('052-3039955');
  });

  it('OpenAI נופל - 502 עם הודעה, לא קריסה', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    const mod = await import('@/app/api/daily-report/classify/route');
    const res = await mod.POST(asRole('shift_supervisor', { method: 'POST', body: { tickets: TICKETS } }));
    expect(res.status).toBe(502);
    expect((await res.json()).success).toBe(false);
  });

  it('בלי פניות - 400; בלי מפתח - 503', async () => {
    const mod = await import('@/app/api/daily-report/classify/route');
    expect((await mod.POST(asRole('shift_supervisor', { method: 'POST', body: {} }))).status).toBe(400);
    delete process.env.OPENAI_API_KEY;
    const res = await mod.POST(asRole('shift_supervisor', { method: 'POST', body: { tickets: TICKETS } }));
    expect(res.status).toBe(503);
  });

  it('GET מחזיר את הכללים; PUT שומר אותם לפי הרשות מהשרת', async () => {
    const mod = await import('@/app/api/daily-report/classify/route');
    const getRes = await mod.GET(asRole('shift_supervisor'));
    expect((await getRes.json()).data.classification_rules).toContain('כלל בדיקה');

    const putRes = await mod.PUT(
      asRole('call_center_manager', { method: 'PUT', body: { classification_rules: 'כללים חדשים' } })
    );
    expect(putRes.status).toBe(200);
    const upsert = calls.find(c => c.op === 'upsert' && c.table === 'daily_report_settings');
    expect(upsert.rows.classification_rules).toBe('כללים חדשים');
    expect(upsert.rows.municipality_id).toBe('muni-1');
  });
});
