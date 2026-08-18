import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { config } from '@/middleware';

/**
 * YOA-23: כל דף תחת app/ חייב להיות מכוסה ב-matcher של ה-middleware, אלא אם
 * הוא ציבורי במפורש. `/inspection` ו-`/test-updates` נשמטו ממנו והיו נגישים
 * לכל אחד ברשת בלי התחברות - בלי שום שגיאה שתסגיר את זה.
 *
 * זו המקבילה לבדיקת חוזה האבטחה של ה-API, שמכסה רק את app/api.
 */

const APP_DIR = path.join(process.cwd(), 'app');

/** דפים שנגישים בכוונה ללא התחברות, עם הנימוק לכל אחד. */
const PUBLIC_PAGES = {
  '/': 'דף הנחיתה - מפנה להתחברות',
  '/login': 'דף ההתחברות עצמו',
  '/register': 'הרשמה ציבורית (התפקיד ננעל בשרת - YOA-12)',
  '/reset-password': 'איפוס סיסמה מקישור',
  '/duty-form/[departmentId]': 'טופס תורנות בקישור חתום HMAC שנשלח בוואטסאפ',
  '/event/join/[token]': 'הצטרפות אורח לאירוע לפי טוקן הזמנה',
  '/event/live/[token]': 'צפייה באירוע לפי טוקן הזמנה',
  '/survey/[token]': 'מילוי סקר על ידי תושב',
};

function findPages(dir, prefix = '') {
  const pages = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'api') continue; // מכוסה ב-api-auth-contract
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      pages.push(...findPages(full, `${prefix}/${entry.name}`));
    } else if (entry.name === 'page.js') {
      pages.push(prefix || '/');
    }
  }
  return pages;
}

/** '/admin/:path*' מכסה את /admin ואת כל מה שתחתיו; '/screen' מכסה רק אותו. */
function isCovered(pagePath, matcher) {
  return matcher.some((pattern) => {
    if (pattern.endsWith('/:path*')) {
      const base = pattern.slice(0, -'/:path*'.length);
      return pagePath === base || pagePath.startsWith(base + '/');
    }
    return pagePath === pattern;
  });
}

const pages = findPages(APP_DIR);

describe('שערי דפים: כל דף מוגן נמצא ב-matcher של ה-middleware', () => {
  it('נמצאו דפים לסריקה', () => {
    expect(pages.length).toBeGreaterThan(20);
  });

  it('אין דף מוגן מחוץ ל-matcher', () => {
    const unguarded = pages
      .filter((p) => !(p in PUBLIC_PAGES))
      .filter((p) => !isCovered(p, config.matcher));
    expect(unguarded, 'דפים נגישים ללא התחברות שאינם ברשימת הציבוריים').toEqual([]);
  });

  it('רשימת הדפים הציבוריים אינה מכילה נתיבים שנמחקו', () => {
    const stale = Object.keys(PUBLIC_PAGES).filter((p) => !pages.includes(p));
    expect(stale).toEqual([]);
  });

  it('אין דף בדיקות בפרודקשן', () => {
    const testPages = pages.filter((p) => /test|demo|playground|sandbox/i.test(p));
    expect(testPages).toEqual([]);
  });
});
