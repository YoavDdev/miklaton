import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = '8h';

function getSecret() {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return JWT_SECRET;
}

export function signToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, getSecret());
  } catch (error) {
    return null;
  }
}

/**
 * מאמת בקשה: קורא את הטוקן קודם מעוגיית auth-token (HttpOnly),
 * ואם אין - מנסה Authorization: Bearer (לתאימות עם קריאות שרת/כלים).
 * מחזיר { valid, user } כאשר user הוא ה-payload של ה-JWT.
 */
export async function verifyAuth(request) {
  try {
    let token = request.cookies?.get?.('auth-token')?.value;
    if (!token) {
      const authHeader = request.headers.get('authorization') || '';
      token = authHeader.replace('Bearer ', '').trim();
    }
    if (!token) return { valid: false };
    const user = verifyToken(token);
    if (!user) return { valid: false };
    return { valid: true, user };
  } catch {
    return { valid: false };
  }
}

/**
 * בדיקת אימות + תפקיד בשורה אחת עבור API routes.
 *
 * שימוש:
 *   const auth = await requireRole(request, ['call_center_manager', 'admin']);
 *   if (auth.error) return auth.error;
 *   // auth.user זמין כאן
 *
 * roles ריק/לא מועבר = כל משתמש מחובר.
 * admin תמיד מורשה.
 */
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * בדיקת "טוקן מסך" עבור מסך המוקד הציבורי (/screen).
 * הטוקן מגיע בעוגיית screen-key (שה-middleware קובע מ-?key=) או בפרמטר ?key=.
 * מושווה מול SCREEN_TOKEN מה-env. אם SCREEN_TOKEN לא מוגדר - תמיד false.
 */
export function verifyScreenKey(request) {
  const expected = process.env.SCREEN_TOKEN;
  if (!expected) return false;
  let key = request.cookies?.get?.('screen-key')?.value;
  if (!key) {
    try {
      key = new URL(request.url).searchParams.get('key');
    } catch {
      key = null;
    }
  }
  return safeCompare(key, expected);
}

/**
 * כמו requireRole, אבל מכבד גם טוקן מסך (עבור ה-API שמסך המוקד צורך).
 * טוקן מסך תקף => מותר, עם user מלאכותי { role: 'screen' }.
 */
export async function requireRoleOrScreen(request, roles = []) {
  if (verifyScreenKey(request)) {
    return { user: { role: 'screen', name: 'מסך מוקד' } };
  }
  return requireRole(request, roles);
}

/**
 * טוקן חתום לקישורי טופס תורנות (/duty-form) שנשלחים למנהלי מכלולים ב-WhatsApp.
 * HMAC-SHA256 של מזהה המכלול עם DUTY_FORM_SECRET - כך שאי אפשר לנחש קישור
 * למכלול אחר מתוך ה-ID. הטוקן קבוע פר-מכלול (קישורי WhatsApp לא פגים).
 */
export function signDutyFormToken(departmentId) {
  const secret = process.env.DUTY_FORM_SECRET;
  if (!secret) {
    throw new Error('DUTY_FORM_SECRET environment variable is not set');
  }
  return crypto
    .createHmac('sha256', secret)
    .update(String(departmentId))
    .digest('hex')
    .slice(0, 32);
}

export function verifyDutyFormToken(departmentId, token) {
  if (!process.env.DUTY_FORM_SECRET || !departmentId || !token) return false;
  return safeCompare(token, signDutyFormToken(departmentId));
}

export async function requireRole(request, roles = []) {
  const authResult = await verifyAuth(request);
  if (!authResult.valid) {
    return {
      error: NextResponse.json({ error: 'לא מחובר' }, { status: 401 }),
    };
  }
  const { user } = authResult;
  if (roles.length > 0 && user.role !== 'admin' && !roles.includes(user.role)) {
    return {
      error: NextResponse.json({ error: 'אין הרשאה לפעולה זו' }, { status: 403 }),
    };
  }
  return { user };
}
