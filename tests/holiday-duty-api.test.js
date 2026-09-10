import { describe, it, expect, vi } from 'vitest';
import { makeRequest } from './helpers/request';
import { createChainable } from './helpers/supabase-mock';
import { signToken } from '@/lib/auth';

vi.mock('@supabase/supabase-js', () => ({ createClient: () => createChainable() }));

const managerCookie = { 'auth-token': signToken({ id: 'u1', role: 'call_center_manager' }) };
const operatorCookie = { 'auth-token': signToken({ id: 'u2', role: 'operator' }) };

describe('GET /api/holiday-duty', () => {
  it('דוחה בקשה בלי טוקן', async () => {
    const { GET } = await import('@/app/api/holiday-duty/route');
    const res = await GET(makeRequest('/api/holiday-duty?municipality_id=yehud'));
    expect(res.status).toBe(401);
  });

  it('מוקדן רשאי לקרוא את הלוח', async () => {
    const { GET } = await import('@/app/api/holiday-duty/route');
    const res = await GET(
      makeRequest('/api/holiday-duty?municipality_id=yehud', { cookies: operatorCookie })
    );
    expect(res.status).toBe(200);
  });

  it('דורש municipality_id', async () => {
    const { GET } = await import('@/app/api/holiday-duty/route');
    const res = await GET(makeRequest('/api/holiday-duty', { cookies: operatorCookie }));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/holiday-duty/entries', () => {
  it('דוחה מוקדן — עריכה שמורה למנהל המוקד', async () => {
    const { POST } = await import('@/app/api/holiday-duty/entries/route');
    const res = await POST(
      makeRequest('/api/holiday-duty/entries', {
        method: 'POST',
        cookies: operatorCookie,
        body: { topic_id: 't1', municipality_id: 'yehud', contact_name: 'דוד דרזי' },
      })
    );
    expect(res.status).toBe(403);
  });

  it('מקבל מנהל מוקד', async () => {
    const { POST } = await import('@/app/api/holiday-duty/entries/route');
    const res = await POST(
      makeRequest('/api/holiday-duty/entries', {
        method: 'POST',
        cookies: managerCookie,
        body: { topic_id: 't1', municipality_id: 'yehud', contact_name: 'דוד דרזי' },
      })
    );
    expect(res.status).toBeLessThan(400);
  });

  it('דוחה שורה בלי שם איש קשר', async () => {
    const { POST } = await import('@/app/api/holiday-duty/entries/route');
    const res = await POST(
      makeRequest('/api/holiday-duty/entries', {
        method: 'POST',
        cookies: managerCookie,
        body: { topic_id: 't1', municipality_id: 'yehud' },
      })
    );
    expect(res.status).toBe(400);
  });
});

describe('POST /api/holiday-duty/topics', () => {
  it('דוחה נושא בלי שם', async () => {
    const { POST } = await import('@/app/api/holiday-duty/topics/route');
    const res = await POST(
      makeRequest('/api/holiday-duty/topics', {
        method: 'POST',
        cookies: managerCookie,
        body: { municipality_id: 'yehud', holiday_period_id: 'p1' },
      })
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /api/holiday-duty/contacts', () => {
  it('סגור בפני מוקדן — הבורר הוא כלי עריכה', async () => {
    const { GET } = await import('@/app/api/holiday-duty/contacts/route');
    const res = await GET(
      makeRequest('/api/holiday-duty/contacts?municipality_id=yehud', { cookies: operatorCookie })
    );
    expect(res.status).toBe(403);
  });
});
