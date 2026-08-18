import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

/**
 * טוקן קבוע להעלאת סידור ביטחון מקישור, בלי התחברות.
 *
 * אריאל עובד באקסל כבר שנים ולא רגיל להיכנס לאתר. במקום לדרוש ממנו הרגל חדש,
 * הוא מקבל קישור קבוע בוואטסאפ, לוחץ, וגורר את הקובץ.
 *
 * מרחב נפרד מ-signDutyFormToken למרות אותו סוד: קידומת ההקשר מבטיחה
 * שקישור טופס תורנות שדלף לא יאפשר גם העלאת סידור, ולהפך.
 */
export function signScheduleUploadToken(departmentId) {
  const secret = process.env.DUTY_FORM_SECRET;
  if (!secret) {
    throw new Error('DUTY_FORM_SECRET environment variable is not set');
  }
  return crypto
    .createHmac('sha256', secret)
    .update(`schedule-upload:${departmentId}`)
    .digest('hex')
    .slice(0, 32);
}

export function verifyScheduleUploadToken(departmentId, token) {
  if (!process.env.DUTY_FORM_SECRET || !departmentId || !token) return false;
  return safeCompare(token, signScheduleUploadToken(departmentId));
}

export function verifyDutyFormToken(departmentId, token) {
  if (!process.env.DUTY_FORM_SECRET || !departmentId || !token) return false;
  return safeCompare(token, signDutyFormToken(departmentId));
}

/**
 * מאמת שהמשתמש רשאי לפעול על מכלול מסוים.
 *
 * הדפוס שחזר בכל המערכת: ראוט בודק שהמשתמש מחובר ובעל תפקיד מתאים, ואז
 * לוקח department_id **מגוף הבקשה** ומשתמש בו בלי להשוות אותו לכלום. כך
 * כל אחד מ-11 מנהלי המכלול יכול היה לשנות נתונים של מכלול אחר (YOA-22, YOA-27).
 *
 * מנהלת המוקד ואדמין מנהלים את כל המכלולים - זה תפקידם. מנהל מכלול מוגבל
 * למכלול שרשום בפרופיל שלו בשרת, לא לזה שביקש.
 *
 * מחזיר { error } מוכן להחזרה, או {} כשמותר.
 */
export async function requireDepartmentAccess(request, departmentId) {
  const authResult = await verifyAuth(request);
  if (!authResult.valid) {
    return { error: NextResponse.json({ success: false, error: 'לא מחובר' }, { status: 401 }) };
  }

  const { role, userId } = authResult.user;
  if (role === 'admin' || role === 'call_center_manager') return { user: authResult.user };

  if (!departmentId) {
    return {
      error: NextResponse.json({ success: false, error: 'department_id required' }, { status: 400 }),
    };
  }

  const supabase = getEventSupabase();
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('department_id')
    .eq('id', userId)
    .single();

  if (profile?.department_id && profile.department_id === departmentId) {
    return { user: authResult.user };
  }

  return {
    error: NextResponse.json(
      { success: false, error: 'אין הרשאה למכלול זה' },
      { status: 403 }
    ),
  };
}

// --- Event access (emergency events) ---

const EVENT_TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/**
 * טוקן הזמנה קריפטוגרפי לאירוע חדש (מחליף את Math.random הישן).
 */
export function generateEventToken(length = 16) {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += EVENT_TOKEN_ALPHABET[bytes[i] % EVENT_TOKEN_ALPHABET.length];
  }
  return result;
}

let eventSupabase = null;
function getEventSupabase() {
  if (!eventSupabase) {
    // service role בלבד - הטבלאות נעולות ל-anon אחרי המיגרציה
    eventSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return eventSupabase;
}

/**
 * שער גישה לאירוע: משתמש מחובר (עוגיית auth-token) או אורח עם
 * header בשם X-Event-Token שתואם את invite_token של האירוע.
 * מחזיר את האירוע הטעון כדי לחסוך שליפה כפולה ב-route.
 */
export async function requireEventAccess(request, eventId) {
  const supabase = getEventSupabase();
  const { data: event, error: eventError } = await supabase
    .from('emergency_events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (eventError && eventError.code !== 'PGRST116') {
    return { error: NextResponse.json({ success: false, error: 'שגיאה זמנית, נסה שוב' }, { status: 503 }) };
  }

  if (!event) {
    return { error: NextResponse.json({ success: false, error: 'אירוע לא נמצא' }, { status: 404 }) };
  }

  const authResult = await verifyAuth(request);
  if (authResult.valid) {
    return { user: authResult.user, event };
  }

  const token = request.headers.get('x-event-token');
  if (token && safeCompare(token, event.invite_token)) {
    return { guest: true, event };
  }

  return { error: NextResponse.json({ success: false, error: 'לא מחובר' }, { status: 401 }) };
}

/**
 * מדיניות סיסמאות אחידה למערכת (הרשמה + שני נתיבי החלפת סיסמה).
 * מחזיר מערך הודעות שגיאה בעברית; ריק = תקין.
 */
export function validatePassword(password) {
  const errors = [];
  if (!password || password.length < 8) {
    errors.push('הסיסמה חייבת להכיל לפחות 8 תווים');
  }
  if (!/[A-Z]/.test(password || '')) {
    errors.push('הסיסמה חייבת להכיל לפחות אות גדולה אחת באנגלית');
  }
  if (!/[a-z]/.test(password || '')) {
    errors.push('הסיסמה חייבת להכיל לפחות אות קטנה אחת באנגלית');
  }
  if (!/[0-9]/.test(password || '')) {
    errors.push('הסיסמה חייבת להכיל לפחות ספרה אחת');
  }
  return errors;
}

export async function requireRole(request, roles = []) {
  const authResult = await verifyAuth(request);
  if (!authResult.valid) {
    return {
      error: NextResponse.json({ success: false, error: 'לא מחובר' }, { status: 401 }),
    };
  }
  const { user } = authResult;
  if (roles.length > 0 && user.role !== 'admin' && !roles.includes(user.role)) {
    return {
      error: NextResponse.json({ success: false, error: 'אין הרשאה לפעולה זו' }, { status: 403 }),
    };
  }
  return { user };
}
