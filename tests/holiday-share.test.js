import { describe, it, expect, vi } from 'vitest';
import { makeRequest } from './helpers/request';
import { createChainable } from './helpers/supabase-mock';
import { signHolidayBoardToken, verifyHolidayBoardToken, signDutyFormToken } from '@/lib/auth';

vi.mock('@supabase/supabase-js', () => ({ createClient: () => createChainable() }));

const PERIOD = '16aa0bb0-2ed4-4f56-8984-a992bb6a31fd';

describe('טוקן לוח חג ציבורי', () => {
  it('יציב לאותה תקופה', () => {
    expect(signHolidayBoardToken(PERIOD)).toBe(signHolidayBoardToken(PERIOD));
  });

  it('שונה בין תקופות', () => {
    expect(signHolidayBoardToken(PERIOD)).not.toBe(signHolidayBoardToken('other-period'));
  });

  it('מאמת את הטוקן הנכון ודוחה שגוי', () => {
    expect(verifyHolidayBoardToken(PERIOD, signHolidayBoardToken(PERIOD))).toBe(true);
    expect(verifyHolidayBoardToken(PERIOD, 'x'.repeat(32))).toBe(false);
    expect(verifyHolidayBoardToken(PERIOD, '')).toBe(false);
    expect(verifyHolidayBoardToken('', signHolidayBoardToken(PERIOD))).toBe(false);
  });

  it('אינו מקבל טוקן של תקופה אחרת', () => {
    expect(verifyHolidayBoardToken(PERIOD, signHolidayBoardToken('other'))).toBe(false);
  });

  it('מרחב נפרד מטופס התורנות - אותו מזהה נותן טוקן אחר', () => {
    expect(signHolidayBoardToken(PERIOD)).not.toBe(signDutyFormToken(PERIOD));
  });
});

describe('GET /api/holiday-duty/share', () => {
  it('דוחה בלי טוקן', async () => {
    const { GET } = await import('@/app/api/holiday-duty/share/route');
    const res = await GET(makeRequest(`/api/holiday-duty/share?period=${PERIOD}`));
    expect(res.status).toBe(403);
  });

  it('דוחה טוקן שגוי', async () => {
    const { GET } = await import('@/app/api/holiday-duty/share/route');
    const res = await GET(makeRequest(`/api/holiday-duty/share?period=${PERIOD}&t=${'a'.repeat(32)}`));
    expect(res.status).toBe(403);
  });

  it('דוחה בלי מזהה תקופה', async () => {
    const { GET } = await import('@/app/api/holiday-duty/share/route');
    const res = await GET(makeRequest('/api/holiday-duty/share'));
    expect(res.status).toBe(400);
  });

  it('מקבל טוקן תקין בלי התחברות', async () => {
    const { GET } = await import('@/app/api/holiday-duty/share/route');
    const res = await GET(
      makeRequest(`/api/holiday-duty/share?period=${PERIOD}&t=${signHolidayBoardToken(PERIOD)}`)
    );
    expect(res.status).toBe(200);
  });
});
