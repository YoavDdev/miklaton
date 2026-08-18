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
