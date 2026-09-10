import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signToken } from '@/lib/auth';
import { makeRequest } from './helpers/request';

/**
 * YOA-42 שלב 3: משיכת אירועי העירייה. עקרון האי-תלות של docs/16 -
 * אתר העירייה נופל ⇒ הדוח יוצא בכל מקרה (200 עם רשימה ריקה, לא 500).
 */
const asRole = (role, date = '2026-08-26') =>
  makeRequest(`/api/daily-report/city-events?date=${date}`, {
    cookies: { 'auth-token': signToken({ userId: 'u1', role, name: 'בודקת' }) },
  });

const wpEvent = (date, hours, title, location) => ({
  title: { rendered: title },
  acf: { event_date: date, event_hours: hours, location },
});

describe('/api/daily-report/city-events', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });
  beforeEach(() => { vi.resetModules(); });

  it('חסום למוקדן', async () => {
    const mod = await import('@/app/api/daily-report/city-events/route');
    expect((await mod.GET(asRole('operator'))).status).toBe(403);
  });

  it('מושך מאתר העירייה ומחזיר את אירועי יום הדוח בלבד', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        wpEvent('20260826', '09:00:00', 'גן עם הורה', 'הדגנים 54 יהוד-מונוסון'),
        wpEvent('20260901', '10:00:00', 'אירוע עתידי', 'מקום'),
      ],
    });
    const mod = await import('@/app/api/daily-report/city-events/route');
    const res = await mod.GET(asRole('shift_supervisor'));
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toEqual([{ name: 'גן עם הורה - הדגנים 54', date: '26.08.2026', hour: '09:00' }]);
  });

  it('אתר העירייה לא זמין - 200 עם רשימה ריקה ואזהרה', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const mod = await import('@/app/api/daily-report/city-events/route');
    const res = await mod.GET(asRole('shift_supervisor'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.warning).toBeTruthy();
  });

  it('מבקש רק את השדות הנחוצים - yoast_head שובר את ה-JSON', async () => {
    // באתר העירייה תוסף ה-SEO מזריק nonce="..." בלי לברוח את הגרשיים,
    // וזה שובר את כל ה-JSON. הפתרון היחיד בצד שלנו הוא לא לבקש את השדה.
    const calls = [];
    global.fetch = vi.fn().mockImplementation((url) => {
      calls.push(url);
      return Promise.resolve({
        ok: true,
        headers: { get: () => '1' },
        json: async () => [wpEvent('20260826', '09:00:00', 'אירוע', 'מקום')],
      });
    });
    const mod = await import('@/app/api/daily-report/city-events/route');
    await mod.GET(asRole('shift_supervisor'));
    expect(calls.length).toBeGreaterThan(0);
    for (const url of calls) expect(url).toContain('_fields=');
    for (const url of calls) expect(url).not.toContain('yoast');
  });

  it('מושך את כל העמודים לפי X-WP-TotalPages ולא רק את הראשונים', async () => {
    // 3,165 אירועים באתר, ממוינים לפי תאריך הפרסום ולא תאריך האירוע.
    // משיכה חלקית מפילה בשקט אירוע שנוצר מזמן ומתקיים מחר.
    const pages = { 1: [], 2: [], 3: [], 4: [wpEvent('20260826', '08:00:00', 'אירוע בעמוד רביעי', 'מקום')] };
    global.fetch = vi.fn().mockImplementation((url) => {
      const page = Number(new URL(url).searchParams.get('page'));
      return Promise.resolve({
        ok: true,
        headers: { get: (h) => (h.toLowerCase() === 'x-wp-totalpages' ? '4' : null) },
        json: async () => pages[page] || [],
      });
    });
    const mod = await import('@/app/api/daily-report/city-events/route');
    const res = await mod.GET(asRole('shift_supervisor'));
    const { data } = await res.json();
    expect(data).toEqual([{ name: 'אירוע בעמוד רביעי - מקום', date: '26.08.2026', hour: '08:00' }]);
  });

  it('נתונים פגומים מהאתר - אזהרה שונה מ"לא זמין"', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => '1' },
      json: async () => { throw new SyntaxError('Unexpected token'); },
    });
    const mod = await import('@/app/api/daily-report/city-events/route');
    const res = await mod.GET(asRole('shift_supervisor'));
    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.warning).toContain('פגומים');
  });

  it('בלי תאריך - 400', async () => {
    const mod = await import('@/app/api/daily-report/city-events/route');
    const res = await mod.GET(
      makeRequest('/api/daily-report/city-events', {
        cookies: { 'auth-token': signToken({ userId: 'u1', role: 'shift_supervisor' }) },
      })
    );
    expect(res.status).toBe(400);
  });
});
