import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signToken } from '@/lib/auth';
import { makeRequest } from './helpers/request';

/**
 * YOA-30: בלוק כתיבת ה-audit של מצב חירום הועתק בטעות ל-GET (ושבר אותו ב-500),
 * בזמן שה-POST - הפעולה שבאמת משנה מצב - לא כתב audit בכלל. הבדיקות כאן
 * מעגנות את החלוקה הנכונה: שינוי מצב נרשם, קריאת סטטוס לא.
 *
 * המוק כאן מקליט insertים, בניגוד למוק הכללי שבולע הכל - כי הטענה היא
 * "נכתב audit", לא רק "הראוט לא נפל".
 */
const { inserts, chain } = vi.hoisted(() => {
  const inserts = [];
  function chain(table) {
    return new Proxy(function () {}, {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve) => resolve({ data: { id: 'war-mode-row' }, error: null });
        }
        if (prop === Symbol.toPrimitive || prop === 'toJSON') return undefined;
        return (arg) => {
          if (prop === 'insert') inserts.push({ table, row: arg });
          return chain(table);
        };
      },
      apply() {
        return chain(table);
      },
    });
  }
  return { inserts, chain };
});

vi.mock('@/lib/supabase-server', () => ({
  supabase: { from: (table) => chain(table) },
}));

const asRole = (role, options = {}) =>
  makeRequest('/api/war-mode', {
    ...options,
    cookies: { 'auth-token': signToken({ userId: 'user-1', role, name: 'בודק' }) },
  });

describe('audit של מצב חירום', () => {
  beforeEach(() => {
    inserts.length = 0;
  });

  it('הפעלת מצב חירום נרשמת ב-audit_log', async () => {
    const mod = await import('@/app/api/war-mode/route');
    const res = await mod.POST(
      asRole('shift_supervisor', { method: 'POST', body: { is_active: true } })
    );
    expect(res.status).toBe(200);
    const audit = inserts.find((i) => i.table === 'audit_log');
    expect(audit?.row.action).toBe('war_mode_activated');
    expect(audit?.row.details.by).toBe('בודק');
  });

  it('כיבוי מצב חירום נרשם ב-audit_log', async () => {
    const mod = await import('@/app/api/war-mode/route');
    await mod.POST(
      asRole('call_center_manager', { method: 'POST', body: { is_active: false } })
    );
    const audit = inserts.find((i) => i.table === 'audit_log');
    expect(audit?.row.action).toBe('war_mode_deactivated');
  });

  it('קריאת סטטוס אינה כותבת audit', async () => {
    const mod = await import('@/app/api/war-mode/route');
    const res = await mod.GET(asRole('operator'));
    expect(res.status).toBe(200);
    expect(inserts.filter((i) => i.table === 'audit_log')).toHaveLength(0);
  });
});
