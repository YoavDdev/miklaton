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
