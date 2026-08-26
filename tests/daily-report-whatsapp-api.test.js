import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signToken } from '@/lib/auth';
import { makeRequest } from './helpers/request';

/**
 * YOA-42: ראוט ניסוח ה-WhatsApp. אותם חוזים כמו הסיווג: הרשאות
 * משמרת, PII לא יוצא, כשל AI מחזיר שגיאה ברורה ולא מפיל את הדוח.
 */
const { chain } = vi.hoisted(() => {
  function chain(table) {
    return new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === 'then') {
          const result =
            table === 'user_profiles'
              ? { data: { municipality_id: 'muni-1' }, error: null }
              : { data: null, error: null };
          return (resolve) => resolve(result);
        }
        if (prop === Symbol.toPrimitive || prop === 'toJSON') return undefined;
        return () => chain(table);
      },
      apply() { return chain(table); },
    });
  }
  return { chain };
});

vi.mock('@/lib/supabase-server', () => ({ supabase: { from: (t) => chain(t) } }));

const BODY = {
  text: '[13:05] שריפת קוצים מאחורי העצמאות, כיבוי אש במקום',
  tickets: [{ id: '508484', openedAt: '2026-08-26T09:49:00.000Z', department: 'חשמל', subject: 'עמוד', description: 'עקום', address: 'רם כהן 5', reporterName: 'גיל', reporterPhone: '052-3039955' }],
};

const asRole = (role, options = {}) =>
  makeRequest('/api/daily-report/whatsapp', {
    ...options,
    cookies: { 'auth-token': signToken({ userId: 'u1', role, name: 'בודקת' }) },
  });

describe('/api/daily-report/whatsapp', () => {
  const realFetch = global.fetch;
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    vi.resetModules();
  });
  afterEach(() => { global.fetch = realFetch; });

  it('חסום למוקדן', async () => {
    const mod = await import('@/app/api/daily-report/whatsapp/route');
    expect((await mod.POST(asRole('operator', { method: 'POST', body: BODY }))).status).toBe(403);
  });

  it('מנסח אירועים - ה-PII לא יוצא, ההצלבה מאומתת', async () => {
    let outbound = null;
    global.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      outbound = opts.body;
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ events: [
            { time_label: '26.08 13:05', description: 'שריפת קוצים מאחורי רחוב העצמאות', treatment: 'כיבוי אש במקום', handler: 'כיבוי אש', ticket_id: '999999' },
          ] }) } }],
        }),
      };
    });
    const mod = await import('@/app/api/daily-report/whatsapp/route');
    const res = await mod.POST(asRole('shift_supervisor', { method: 'POST', body: BODY }));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data[0].description).toContain('שריפת קוצים');
    expect(data[0].ticket_id).toBeNull(); // 999999 לא קיים בקובץ
    expect(outbound).toContain('508484');
    expect(outbound).not.toContain('052-3039955');
  });

  it('בלי טקסט - 400; AI נופל - 502', async () => {
    const mod = await import('@/app/api/daily-report/whatsapp/route');
    expect((await mod.POST(asRole('shift_supervisor', { method: 'POST', body: { tickets: [] } }))).status).toBe(400);
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    expect((await mod.POST(asRole('shift_supervisor', { method: 'POST', body: BODY }))).status).toBe(502);
  });
});
