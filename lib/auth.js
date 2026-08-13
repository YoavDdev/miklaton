import jwt from 'jsonwebtoken';
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

export function verifyOperatorPassword(password) {
  return password === process.env.APP_PASSWORD;
}

export function verifyAdminPassword(password) {
  return password === process.env.ADMIN_PASSWORD;
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
