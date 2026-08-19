import { describe, it, expect, vi } from 'vitest';
import { signToken } from '@/lib/auth';
import { makeRequest } from './helpers/request';
import { createChainable } from './helpers/supabase-mock';

vi.mock('@supabase/supabase-js', () => ({ createClient: () => createChainable() }));

/**
 * YOA-22: אימות לבדו אינו הרשאה. הראוטים כאן בדקו שהמשתמש מחובר ולא שהוא
 * מורשה לנתון הספציפי. הבדיקות האלה מעגנות את ההפרדה כדי שלא תיסוג.
 *
 * בדיקת חוזה האבטחה (api-auth-contract) מוודאת שראוט דורש אימות. זו מוודאת
 * שהוא מאמת בעלות - וזה בדיוק מה שהיא לא תפסה.
 */

const DEPT_A = '11111111-1111-4111-8111-111111111111';
const DEPT_B = '22222222-2222-4222-8222-222222222222';

const tokenFor = (role, userId = 'user-1') => signToken({ userId, role, name: 'בודק' });

const asRole = (role, url, options = {}) =>
  makeRequest(url, { ...options, cookies: { 'auth-token': tokenFor(role) } });

describe('/api/departments — כתיבה למנהלת מוקד ואדמין בלבד', () => {
  it.each(['POST', 'PATCH', 'DELETE'])('%s נחסם למנהל מכלול', async (method) => {
    const mod = await import('@/app/api/departments/route');
    const res = await mod[method](
      asRole('sector_manager', `/api/departments?id=${DEPT_A}`, { method, body: { name: 'חדש' } })
    );
    expect(res.status).toBe(403);
  });

  it.each(['POST', 'PATCH', 'DELETE'])('%s נחסם למוקדן', async (method) => {
    const mod = await import('@/app/api/departments/route');
    const res = await mod[method](
      asRole('operator', `/api/departments?id=${DEPT_A}`, { method, body: { name: 'חדש' } })
    );
    expect(res.status).toBe(403);
  });

  it('מנהלת מוקד עוברת - הממשק שלה באמת יוצר מכלולים', async () => {
    const mod = await import('@/app/api/departments/route');
    const res = await mod.POST(
      asRole('call_center_manager', '/api/departments', { method: 'POST', body: { name: 'חדש' } })
    );
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });
});

describe('/api/operator/tasks + messages — פנימיים למוקד', () => {
  it.each([
    ['tasks', '@/app/api/operator/tasks/route'],
    ['messages', '@/app/api/operator/messages/route'],
  ])('GET של %s נחסם למנהל מכלול', async (_name, modulePath) => {
    const mod = await import(/* @vite-ignore */ modulePath);
    const res = await mod.GET(asRole('sector_manager', '/api/operator/x'));
    expect(res.status).toBe(403);
  });

  it.each([
    ['tasks', '@/app/api/operator/tasks/route'],
    ['messages', '@/app/api/operator/messages/route'],
  ])('GET של %s פתוח למוקדן ולמנהלת מוקד', async (_name, modulePath) => {
    const mod = await import(/* @vite-ignore */ modulePath);
    for (const role of ['operator', 'call_center_manager']) {
      const res = await mod.GET(asRole(role, '/api/operator/x'));
      expect(res.status, role).not.toBe(403);
    }
  });
});

describe('/api/duty-form — מכלול נגזר מהפרופיל ולא מהבקשה', () => {
  it('מוקדן לא יכול לקרוא את התורנויות של מכלול', async () => {
    const mod = await import('@/app/api/duty-form/route');
    const res = await mod.GET(asRole('operator', `/api/duty-form?departmentId=${DEPT_A}`));
    expect(res.status).toBe(401);
  });

  it('מוקדן לא יכול לדרוס תורנויות של מכלול', async () => {
    const mod = await import('@/app/api/duty-form/route');
    const res = await mod.POST(
      asRole('operator', '/api/duty-form', {
        method: 'POST',
        body: { departmentId: DEPT_A, duties: [] },
      })
    );
    expect(res.status).toBe(401);
  });

  it('מנהל מכלול לא עובר למכלול שאינו שלו', async () => {
    // המוק מחזיר profile ריק, כלומר department_id לא תואם ל-DEPT_B
    const mod = await import('@/app/api/duty-form/route');
    const res = await mod.GET(asRole('sector_manager', `/api/duty-form?departmentId=${DEPT_B}`));
    expect(res.status).toBe(401);
  });

  it('מנהלת מוקד עוברת - היא זו ששולחת את הקישורים', async () => {
    const mod = await import('@/app/api/duty-form/route');
    const res = await mod.GET(
      asRole('call_center_manager', `/api/duty-form?departmentId=${DEPT_A}`)
    );
    expect(res.status).not.toBe(401);
  });

  it('בקשה בלי מזהה מכלול נדחית לפני כל בדיקת הרשאה', async () => {
    const mod = await import('@/app/api/duty-form/route');
    const res = await mod.GET(asRole('call_center_manager', '/api/duty-form'));
    expect(res.status).toBe(400);
  });
});

describe('אחמ״ש — חלוקת הסמכויות במוקד (docs/15)', () => {
  it('מוקדן אינו יכול להעביר את המערכת למצב חירום', async () => {
    const mod = await import('@/app/api/war-mode/route');
    const res = await mod.POST(
      asRole('operator', '/api/war-mode', { method: 'POST', body: { is_active: true } })
    );
    expect(res.status).toBe(403);
  });

  it.each(['shift_supervisor', 'call_center_manager'])('%s כן יכול', async (role) => {
    const mod = await import('@/app/api/war-mode/route');
    const res = await mod.POST(
      asRole(role, '/api/war-mode', { method: 'POST', body: { is_active: true } })
    );
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });

  // YOA-30: בלוק audit שהועתק מה-POST ל-GET השתמש במשתנים שלא קיימים שם,
  // וכל קריאת סטטוס נפלה ל-500 - הבאנר לא נטען באף דשבורד ולא במסך.
  it('קריאת סטטוס מצב חירום מחזירה 200 למשתמש מחובר', async () => {
    const mod = await import('@/app/api/war-mode/route');
    const res = await mod.GET(asRole('operator', '/api/war-mode'));
    expect(res.status).toBe(200);
  });

  it('קריאת סטטוס מצב חירום מחזירה 200 לטוקן מסך', async () => {
    const mod = await import('@/app/api/war-mode/route');
    const res = await mod.GET(makeRequest('/api/war-mode?key=test-screen-token'));
    expect(res.status).toBe(200);
  });

  it('אחמ״ש רואה מי מחובר, מוקדן לא', async () => {
    const mod = await import('@/app/api/operator/sessions/route');
    expect((await mod.GET(asRole('shift_supervisor', '/api/operator/sessions'))).status).not.toBe(403);
    expect((await mod.GET(asRole('operator', '/api/operator/sessions'))).status).toBe(403);
  });

  it('אחמ״ש מקצה משימות, מוקדן לא', async () => {
    const mod = await import('@/app/api/operator/tasks/route');
    const body = { title: 'בדיקה', assigned_to: 'user-2' };
    expect((await mod.POST(asRole('shift_supervisor', '/api/operator/tasks', { method: 'POST', body }))).status).not.toBe(403);
    expect((await mod.POST(asRole('operator', '/api/operator/tasks', { method: 'POST', body }))).status).toBe(403);
  });

  it('מנהל מכלול נשאר מחוץ למוקד', async () => {
    const tasks = await import('@/app/api/operator/tasks/route');
    const sessions = await import('@/app/api/operator/sessions/route');
    expect((await tasks.GET(asRole('sector_manager', '/api/operator/tasks'))).status).toBe(403);
    expect((await sessions.GET(asRole('sector_manager', '/api/operator/sessions'))).status).toBe(403);
  });
});

describe('עריכת סידור המוקד', () => {
  const body = { department_id: 'd1', shift_id: 's1', week_start: '2026-08-16', day_of_week: 0 };

  it.each(['shift_supervisor', 'call_center_manager'])('%s רשאי להוסיף שיבוץ', async (role) => {
    const mod = await import('@/app/api/call-center-schedule/route');
    const res = await mod.POST(asRole(role, '/api/call-center-schedule', { method: 'POST', body }));
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });

  it.each(['operator', 'sector_manager'])('%s נחסם', async (role) => {
    const mod = await import('@/app/api/call-center-schedule/route');
    const res = await mod.POST(asRole(role, '/api/call-center-schedule', { method: 'POST', body }));
    expect(res.status).toBe(403);
  });

  it('מחיקת שיבוץ בודד חסומה למוקדן', async () => {
    const mod = await import('@/app/api/call-center-schedule/route');
    const res = await mod.DELETE(asRole('operator', '/api/call-center-schedule?id=abc', { method: 'DELETE' }));
    expect(res.status).toBe(403);
  });
});

describe('YOA-27 — בעלות על מכלול בכל שרשרת הביטחון והתורנויות', () => {
  const WRITE_ROUTES = [
    ['security-staff', '@/app/api/security-staff/route', { full_name: 'פלוני' }],
    ['security-shifts', '@/app/api/security-shifts/route', { name: 'בוקר' }],
    ['security-schedule', '@/app/api/security-schedule/route', {}],
    ['security-leave', '@/app/api/security-leave/route', { staff_id: 's1', start_date: '2026-01-01', end_date: '2026-01-02' }],
    ['security-settings', '@/app/api/security-settings/route', { key: 'k', value: 'v' }],
    ['security-daily-order', '@/app/api/security-daily-order/route', { order_date: '2026-08-16' }],
    ['contacts', '@/app/api/contacts/route', { full_name: 'פלוני' }],
  ];

  it.each(WRITE_ROUTES)('%s POST — מנהל מכלול נחסם למכלול שאינו שלו', async (_n, mod, extra) => {
    const m = await import(/* @vite-ignore */ mod);
    const res = await m.POST(
      asRole('sector_manager', '/api/x', { method: 'POST', body: { department_id: DEPT_B, ...extra } })
    );
    expect(res.status).toBe(403);
  });

  it.each(WRITE_ROUTES)('%s POST — מנהלת מוקד עוברת', async (_n, mod, extra) => {
    const m = await import(/* @vite-ignore */ mod);
    const res = await m.POST(
      asRole('call_center_manager', '/api/x', { method: 'POST', body: { department_id: DEPT_B, ...extra } })
    );
    expect(res.status).not.toBe(403);
  });

  it('duty-roster POST — מנהל מכלול נחסם למכלול אחר', async () => {
    const m = await import('@/app/api/duty-roster/route');
    const res = await m.POST(
      asRole('sector_manager', '/api/duty-roster', {
        method: 'POST',
        body: { entries: [{ department_id: DEPT_B, contact_id: 'c1', day_of_week: 0 }] },
      })
    );
    expect(res.status).toBe(403);
  });

  it('duty-roster DELETE bulk — מנהל מכלול נחסם למכלול אחר', async () => {
    const m = await import('@/app/api/duty-roster/route');
    const res = await m.DELETE(
      asRole('sector_manager', `/api/duty-roster?bulk=true&department_id=${DEPT_B}&week_start_date=2026-08-16`, { method: 'DELETE' })
    );
    expect(res.status).toBe(403);
  });

  it('פקודת יום — טוקן מסך אינו כותב שינויי משמרת', async () => {
    const m = await import('@/app/api/security-daily-order/entry/route');
    const req = makeRequest('/api/security-daily-order/entry', {
      method: 'PATCH',
      cookies: { 'screen-key': 'test-screen-token' },
      body: { entry_id: 'e1', change_type: 'removed' },
    });
    const res = await m.PATCH(req);
    expect(res.status).toBe(401);
  });

  it('סימון הודעה כנקראה — מנהל מכלול נחסם', async () => {
    const m = await import('@/app/api/operator/messages/route');
    const res = await m.PUT(
      asRole('sector_manager', '/api/operator/messages', { method: 'PUT', body: { id: 'm1' } })
    );
    expect(res.status).toBe(403);
  });
});

describe('YOA-31 — אירוע חירום הוא מרחב משותף, אבל לא לאורחים', () => {
  it('אורח עם טוקן הזמנה אינו מעדכן משתתפים', async () => {
    const mod = await import('@/app/api/events/[id]/participants/[participantId]/route');
    const req = makeRequest('/api/events/e1/participants/p1', {
      method: 'PATCH',
      headers: { 'x-event-token': 'whatever' },
      body: { field_status: 'arrived' },
    });
    const res = await mod.PATCH(req, { params: { id: 'e1', participantId: 'p1' } });
    // או 401 (הטוקן לא תואם) או 403 (אורח מזוהה) - בשני המקרים לא מעודכן
    expect([401, 403]).toContain(res.status);
  });

  it('משתמש מחובר כן מעדכן — זה מה שמוקדן עושה בזמן אמת', async () => {
    const mod = await import('@/app/api/events/[id]/participants/[participantId]/route');
    const res = await mod.PATCH(
      asRole('operator', '/api/events/e1/participants/p1', {
        method: 'PATCH',
        body: { field_status: 'arrived' },
      }),
      { params: { id: 'e1', participantId: 'p1' } }
    );
    expect(res.status).not.toBe(403);
  });
});
