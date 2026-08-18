import { describe, it, expect, vi } from 'vitest';
import {
  signScheduleUploadToken,
  verifyScheduleUploadToken,
  signDutyFormToken,
  verifyDutyFormToken,
} from '@/lib/auth';
import { makeRequest } from './helpers/request';
import { createChainable } from './helpers/supabase-mock';

vi.mock('@supabase/supabase-js', () => ({ createClient: () => createChainable() }));

const DEPT_A = '11111111-1111-4111-8111-111111111111';
const DEPT_B = '22222222-2222-4222-8222-222222222222';

describe('טוקן העלאת סידור', () => {
  it('יציב לאותו מכלול ושונה בין מכלולים', () => {
    expect(signScheduleUploadToken(DEPT_A)).toBe(signScheduleUploadToken(DEPT_A));
    expect(signScheduleUploadToken(DEPT_A)).not.toBe(signScheduleUploadToken(DEPT_B));
  });

  it('מאמת נכון ודוחה של מכלול אחר', () => {
    const token = signScheduleUploadToken(DEPT_A);
    expect(verifyScheduleUploadToken(DEPT_A, token)).toBe(true);
    expect(verifyScheduleUploadToken(DEPT_B, token)).toBe(false);
  });

  it('הפרדת מרחבים: טוקן טופס תורנות אינו מאפשר העלאת סידור, ולהפך', () => {
    const dutyToken = signDutyFormToken(DEPT_A);
    const uploadToken = signScheduleUploadToken(DEPT_A);
    expect(uploadToken).not.toBe(dutyToken);
    expect(verifyScheduleUploadToken(DEPT_A, dutyToken)).toBe(false);
    expect(verifyDutyFormToken(DEPT_A, uploadToken)).toBe(false);
  });

  it('דוחה קלט חסר בלי לקרוס', () => {
    expect(verifyScheduleUploadToken(DEPT_A, '')).toBe(false);
    expect(verifyScheduleUploadToken('', signScheduleUploadToken(DEPT_A))).toBe(false);
    expect(verifyScheduleUploadToken(DEPT_A, null)).toBe(false);
  });
});

describe('/api/schedule-upload — ציבורי אבל צר', () => {
  const load = () => import('@/app/api/schedule-upload/route');

  it('GET נדחה בלי טוקן', async () => {
    const mod = await load();
    const res = await mod.GET(makeRequest(`/api/schedule-upload?departmentId=${DEPT_A}`));
    expect(res.status).toBe(401);
  });

  it('GET נדחה עם טוקן של מכלול אחר', async () => {
    const mod = await load();
    const foreign = signScheduleUploadToken(DEPT_B);
    const res = await mod.GET(
      makeRequest(`/api/schedule-upload?departmentId=${DEPT_A}&t=${foreign}`)
    );
    expect(res.status).toBe(401);
  });

  it('GET נדחה עם טוקן טופס תורנות', async () => {
    const mod = await load();
    const duty = signDutyFormToken(DEPT_A);
    const res = await mod.GET(
      makeRequest(`/api/schedule-upload?departmentId=${DEPT_A}&t=${duty}`)
    );
    expect(res.status).toBe(401);
  });

  it('POST נדחה בלי טוקן', async () => {
    const mod = await load();
    const res = await mod.POST(
      makeRequest('/api/schedule-upload', {
        method: 'POST',
        body: { department_id: DEPT_A, week_start: '2026-08-16', entries: [] },
      })
    );
    expect(res.status).toBe(401);
  });

  it('GET עם טוקן נכון אינו מוחזר כ-401', async () => {
    const mod = await load();
    const token = signScheduleUploadToken(DEPT_A);
    const res = await mod.GET(
      makeRequest(`/api/schedule-upload?departmentId=${DEPT_A}&t=${token}`)
    );
    expect(res.status).not.toBe(401);
  });
});

describe('/api/schedule-upload/link — מאומת בלבד', () => {
  it('נדחה למשתמש לא מחובר', async () => {
    const mod = await import('@/app/api/schedule-upload/link/route');
    const res = await mod.GET(makeRequest(`/api/schedule-upload/link?departmentId=${DEPT_A}`));
    expect(res.status).toBe(401);
  });
});
