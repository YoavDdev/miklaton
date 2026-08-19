import { describe, it, expect, vi } from 'vitest';
import { signToken, signDutyFormToken } from '@/lib/auth';
import { makeRequest } from './helpers/request';

/**
 * YOA-32: הראוט הנפיק למנהל מכלול טוקנים חתומים של כל המכלולים. טוקן כזה
 * מאפשר לכתוב תורנויות של מכלול זר דרך /duty-form — אותה פרצת בעלות של
 * YOA-22, רק דרך הדלת של הטוקנים. הבדיקות מעגנות: מנהלת המוקד מקבלת את
 * כולם, מנהל מכלול רק את שלו.
 *
 * המוק עונה פר-טבלה: הפרופיל של הקורא ורשימת המכלולים, כדי שהטענה תהיה
 * על תוכן התשובה ולא רק על סטטוס.
 */
const { state, chain, DEPT_A, DEPT_B } = vi.hoisted(() => {
  const DEPT_A = '11111111-1111-4111-8111-111111111111';
  const DEPT_B = '22222222-2222-4222-8222-222222222222';
  const state = { profileDepartmentId: DEPT_A };
  function chain(table) {
    return new Proxy(function () {}, {
      get(_target, prop) {
        if (prop === 'then') {
          const result =
            table === 'user_profiles'
              ? { data: { department_id: state.profileDepartmentId }, error: null }
              : { data: [{ id: DEPT_A }, { id: DEPT_B }], error: null };
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
  return { state, chain, DEPT_A, DEPT_B };
});

vi.mock('@/lib/supabase-server', () => ({
  supabase: { from: (table) => chain(table) },
}));

const asRole = (role) =>
  makeRequest('/api/duty-form/links', {
    cookies: { 'auth-token': signToken({ userId: 'user-1', role, name: 'בודק' }) },
  });

describe('/api/duty-form/links — טוקן רק למכלול שבבעלותך', () => {
  it('מנהל מכלול מקבל אך ורק את הטוקן של המכלול שלו', async () => {
    state.profileDepartmentId = DEPT_A;
    const mod = await import('@/app/api/duty-form/links/route');
    const res = await mod.GET(asRole('sector_manager'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Object.keys(body.tokens)).toEqual([DEPT_A]);
    expect(body.tokens[DEPT_A]).toBe(signDutyFormToken(DEPT_A));
  });

  it('מנהל מכלול בלי שיוך מקבל אפס טוקנים, לא שגיאה', async () => {
    state.profileDepartmentId = null;
    const mod = await import('@/app/api/duty-form/links/route');
    const res = await mod.GET(asRole('sector_manager'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.tokens).toEqual({});
  });

  it('מנהלת המוקד מקבלת טוקנים לכל המכלולים הפעילים', async () => {
    const mod = await import('@/app/api/duty-form/links/route');
    const res = await mod.GET(asRole('call_center_manager'));
    const body = await res.json();
    expect(Object.keys(body.tokens).sort()).toEqual([DEPT_A, DEPT_B].sort());
  });

  it('מוקדן חסום', async () => {
    const mod = await import('@/app/api/duty-form/links/route');
    const res = await mod.GET(asRole('operator'));
    expect(res.status).toBe(403);
  });
});
