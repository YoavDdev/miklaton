import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  signToken,
  verifyToken,
  verifyAuth,
  requireRole,
  requireRoleOrScreen,
  verifyScreenKey,
  signDutyFormToken,
  verifyDutyFormToken,
  generateEventToken,
  validatePassword,
} from '@/lib/auth';
import { makeRequest } from './helpers/request';

const USER = { userId: 'u-1', email: 'a@b.co', role: 'operator', name: 'בודק' };

describe('signToken / verifyToken', () => {
  it('מחזיר את ה-payload לטוקן שנחתם', () => {
    const decoded = verifyToken(signToken(USER));
    expect(decoded.userId).toBe('u-1');
    expect(decoded.role).toBe('operator');
  });

  it('דוחה טוקן שנחתם בסוד אחר', () => {
    const forged = jwt.sign(USER, 'not-the-real-secret', { expiresIn: '8h' });
    expect(verifyToken(forged)).toBeNull();
  });

  it('דוחה טוקן שפג תוקפו', () => {
    const expired = jwt.sign(USER, process.env.JWT_SECRET, { expiresIn: -10 });
    expect(verifyToken(expired)).toBeNull();
  });

  it('דוחה מחרוזת שאינה טוקן', () => {
    expect(verifyToken('גיבריש')).toBeNull();
    expect(verifyToken('')).toBeNull();
  });

  it('חותם עם תפוגה של 8 שעות', () => {
    const decoded = verifyToken(signToken(USER));
    expect(decoded.exp - decoded.iat).toBe(8 * 60 * 60);
  });
});

describe('verifyAuth', () => {
  it('מקבל טוקן תקין מעוגיית auth-token', async () => {
    const request = makeRequest('/api/test', { cookies: { 'auth-token': signToken(USER) } });
    const result = await verifyAuth(request);
    expect(result.valid).toBe(true);
    expect(result.user.userId).toBe('u-1');
  });

  it('מקבל טוקן תקין מכותרת Authorization: Bearer', async () => {
    const request = makeRequest('/api/test', {
      headers: { authorization: `Bearer ${signToken(USER)}` },
    });
    const result = await verifyAuth(request);
    expect(result.valid).toBe(true);
    expect(result.user.userId).toBe('u-1');
  });

  it('דוחה בקשה ללא טוקן כלל', async () => {
    const result = await verifyAuth(makeRequest('/api/test'));
    expect(result.valid).toBe(false);
    expect(result.user).toBeUndefined();
  });

  it('דוחה טוקן מזויף בעוגייה', async () => {
    const forged = jwt.sign(USER, 'not-the-real-secret');
    const request = makeRequest('/api/test', { cookies: { 'auth-token': forged } });
    expect((await verifyAuth(request)).valid).toBe(false);
  });

  it('מעדיף את העוגייה על פני הכותרת', async () => {
    const request = makeRequest('/api/test', {
      cookies: { 'auth-token': signToken({ ...USER, userId: 'from-cookie' }) },
      headers: { authorization: `Bearer ${signToken({ ...USER, userId: 'from-header' })}` },
    });
    const result = await verifyAuth(request);
    expect(result.user.userId).toBe('from-cookie');
  });
});

describe('requireRole', () => {
  const tokenFor = (role) => signToken({ ...USER, role });
  const requestAs = (role) => makeRequest('/api/test', { cookies: { 'auth-token': tokenFor(role) } });

  it('מחזיר 401 למשתמש לא מחובר', async () => {
    const result = await requireRole(makeRequest('/api/test'), ['admin']);
    expect(result.error.status).toBe(401);
    expect(result.user).toBeUndefined();
  });

  it('מחזיר 403 למשתמש מחובר בלי התפקיד הנדרש', async () => {
    const result = await requireRole(requestAs('operator'), ['call_center_manager']);
    expect(result.error.status).toBe(403);
  });

  it('מאשר משתמש עם התפקיד הנדרש', async () => {
    const result = await requireRole(requestAs('call_center_manager'), ['call_center_manager']);
    expect(result.error).toBeUndefined();
    expect(result.user.role).toBe('call_center_manager');
  });

  it('admin עובר כל בדיקת תפקיד', async () => {
    const result = await requireRole(requestAs('admin'), ['security_manager']);
    expect(result.error).toBeUndefined();
    expect(result.user.role).toBe('admin');
  });

  it('רשימת תפקידים ריקה = כל משתמש מחובר מאושר', async () => {
    const result = await requireRole(requestAs('operator'), []);
    expect(result.error).toBeUndefined();
  });

  it('רשימת תפקידים ריקה עדיין דוחה משתמש לא מחובר', async () => {
    const result = await requireRole(makeRequest('/api/test'), []);
    expect(result.error.status).toBe(401);
  });
});

describe('verifyScreenKey / requireRoleOrScreen', () => {
  it('מקבל טוקן מסך נכון מעוגיית screen-key', () => {
    const request = makeRequest('/api/test', { cookies: { 'screen-key': 'test-screen-token' } });
    expect(verifyScreenKey(request)).toBe(true);
  });

  it('מקבל טוקן מסך נכון מפרמטר key בכתובת', () => {
    expect(verifyScreenKey(makeRequest('/api/test?key=test-screen-token'))).toBe(true);
  });

  it('דוחה טוקן מסך שגוי ובקשה ללא טוקן', () => {
    expect(verifyScreenKey(makeRequest('/api/test?key=wrong'))).toBe(false);
    expect(verifyScreenKey(makeRequest('/api/test'))).toBe(false);
  });

  it('requireRoleOrScreen מאשר את המסך בלי משתמש מחובר', async () => {
    const request = makeRequest('/api/test', { cookies: { 'screen-key': 'test-screen-token' } });
    const result = await requireRoleOrScreen(request, ['admin']);
    expect(result.error).toBeUndefined();
    expect(result.user.role).toBe('screen');
  });

  it('requireRoleOrScreen נופל חזרה ל-401 בלי טוקן מסך ובלי משתמש', async () => {
    const result = await requireRoleOrScreen(makeRequest('/api/test'), ['admin']);
    expect(result.error.status).toBe(401);
  });
});

describe('duty form tokens', () => {
  it('טוקן יציב לאותו מכלול ושונה בין מכלולים', () => {
    expect(signDutyFormToken('dept-1')).toBe(signDutyFormToken('dept-1'));
    expect(signDutyFormToken('dept-1')).not.toBe(signDutyFormToken('dept-2'));
  });

  it('מאמת טוקן נכון ודוחה טוקן של מכלול אחר', () => {
    const token = signDutyFormToken('dept-1');
    expect(verifyDutyFormToken('dept-1', token)).toBe(true);
    expect(verifyDutyFormToken('dept-2', token)).toBe(false);
  });

  it('דוחה קלט חסר', () => {
    expect(verifyDutyFormToken('dept-1', '')).toBe(false);
    expect(verifyDutyFormToken('', signDutyFormToken('dept-1'))).toBe(false);
    expect(verifyDutyFormToken('dept-1', null)).toBe(false);
  });
});

describe('generateEventToken', () => {
  it('מייצר טוקן באורך המבוקש מהאלפבית המותר', () => {
    const token = generateEventToken(16);
    expect(token).toHaveLength(16);
    expect(token).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789]+$/);
  });

  it('לא חוזר על עצמו בין קריאות', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateEventToken()));
    expect(tokens.size).toBe(50);
  });
});

describe('validatePassword', () => {
  it('מקבל סיסמה תקינה', () => {
    expect(validatePassword('Miklaton1')).toEqual([]);
  });

  it.each([
    ['Ab1', 'קצרה מדי'],
    ['miklaton1', 'בלי אות גדולה'],
    ['MIKLATON1', 'בלי אות קטנה'],
    ['Miklatonn', 'בלי ספרה'],
  ])('דוחה סיסמה %s (%s)', (password) => {
    expect(validatePassword(password).length).toBeGreaterThan(0);
  });

  it('דוחה ערך ריק/חסר בלי לקרוס', () => {
    expect(validatePassword('').length).toBeGreaterThan(0);
    expect(validatePassword(undefined).length).toBeGreaterThan(0);
    expect(validatePassword(null).length).toBeGreaterThan(0);
  });
});
