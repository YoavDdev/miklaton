import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

/**
 * YOA-21: ראוט שנופל בשקט למפתח ה-anon כשחסר משתנה סביבה מתחזה לתקין
 * ומחזיר שגיאות הרשאה מוזרות במקום לומר מה חסר. הבדיקה הזו מונעת חזרה
 * לדפוס, כולל בראוטים שייכתבו בעתיד.
 */

const API_DIR = path.join(process.cwd(), 'app', 'api');

/**
 * הראוטים היחידים שמותר להם להשתמש במפתח הציבורי: אימות סיסמה.
 * signInWithPassword ו-signUp משנים את התפקיד של הלקוח שעליו הם נקראים,
 * ולכן הם חייבים לקוח זמני נפרד - אחרת הם מרעילים לקוח משותף.
 */
const ANON_ALLOWED = {
  'auth/login': 'אימות סיסמה בלקוח זמני',
  'auth/change-password': 'אימות הסיסמה הישנה בלקוח זמני',
  'profile/change-password': 'אימות הסיסמה הישנה בלקוח זמני',
};

function findRoutes(dir, prefix = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...findRoutes(full, prefix ? `${prefix}/${e.name}` : e.name));
    else if (e.name === 'route.js') out.push({ routePath: prefix, filePath: full });
  }
  return out;
}

const routes = findRoutes(API_DIR);

describe('לקוח Supabase בצד השרת', () => {
  it('אין ולו ראוט אחד שנופל בשקט למפתח הציבורי', () => {
    const offenders = routes
      .filter((r) => /SERVICE_ROLE_KEY\s*\|\|/.test(fs.readFileSync(r.filePath, 'utf8')))
      .map((r) => r.routePath);
    expect(offenders, 'הדפוס SERVICE_ROLE_KEY || ANON_KEY מסתיר תקלת הגדרה').toEqual([]);
  });

  it('רק ראוטי אימות הסיסמה נוגעים במפתח הציבורי', () => {
    const users = routes
      .filter((r) => fs.readFileSync(r.filePath, 'utf8').includes('NEXT_PUBLIC_SUPABASE_ANON_KEY'))
      .map((r) => r.routePath)
      .filter((p) => !(p in ANON_ALLOWED));
    expect(users, 'ראוט שאינו אימות סיסמה אינו צריך את המפתח הציבורי').toEqual([]);
  });

  it('רשימת ההיתר אינה מכילה ראוטים שנמחקו', () => {
    const existing = new Set(routes.map((r) => r.routePath));
    expect(Object.keys(ANON_ALLOWED).filter((p) => !existing.has(p))).toEqual([]);
  });

  it('המודול המשותף נכשל בקול כשהמפתח חסר', async () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'lib', 'supabase-server.js'), 'utf8');
    expect(src).toMatch(/throw new Error/);
    // בלי ההערות: לא נשארה שום נפילה חלופית בקוד עצמו
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(code).not.toMatch(/\|\|/);
  });
});
