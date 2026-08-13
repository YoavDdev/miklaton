import { NextResponse } from 'next/server';

/**
 * Rate limiter פשוט בזיכרון (sliding window לפי IP).
 * הערה: ב-Vercel כל instance מחזיק מונה משלו — זו הגנה בסיסית מספיקה
 * נגד brute-force/הצפה, לא הגנה הרמטית. לשדרוג: Upstash Redis.
 */
const buckets = new Map();
const MAX_BUCKETS = 10000;

function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * בדיקת rate limit. מחזיר NextResponse עם 429 אם חרג — אחרת null.
 *
 * שימוש:
 *   const limited = rateLimit(request, 'login', { limit: 10, windowMs: 60_000 });
 *   if (limited) return limited;
 */
export function rateLimit(request, name, { limit = 20, windowMs = 60_000 } = {}) {
  const key = `${name}:${getClientIp(request)}`;
  const now = Date.now();

  if (buckets.size > MAX_BUCKETS) buckets.clear();

  const timestamps = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= limit) {
    return NextResponse.json(
      { error: 'יותר מדי בקשות, נסה שוב בעוד רגע' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(windowMs / 1000)) } }
    );
  }
  timestamps.push(now);
  buckets.set(key, timestamps);
  return null;
}
