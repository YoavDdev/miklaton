import fs from 'fs';
import path from 'path';
import { describe, it, expect, vi } from 'vitest';
import { makeRequest } from './helpers/request';
import { createChainable } from './helpers/supabase-mock';

// שום בדיקה כאן לא יוצאת לרשת.
vi.mock('@supabase/supabase-js', () => ({ createClient: () => createChainable() }));

const API_DIR = path.join(process.cwd(), 'app', 'api');
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const FAKE_ID = '00000000-0000-4000-8000-000000000000';

/**
 * ראוטים שנגישים בכוונה ללא עוגיית auth-token, עם הנימוק לכל אחד.
 * כל הוספה לרשימה הזו היא החלטת אבטחה - לא דרך לעקוף בדיקה אדומה.
 */
const PUBLIC_ROUTES = {
  'auth/login': 'נקודת הכניסה עצמה',
  'auth/logout': 'מנקה עוגייה, לא חושף מידע',
  'auth/register': 'הרשמה ציבורית (תפקיד ננעל בצד השרת - YOA-12)',
  'auth/verify': 'בודק תקינות טוקן ומחזיר שקר כשאין',
  'auth/me': 'מחזיר את המשתמש הנוכחי או 401',
  'auth/change-password': 'זרימת סיסמה זמנית - מאמת מול הסיסמה הישנה',
  version: 'מספר גרסה בלבד, ללא מידע רגיש',
  'events/join': 'הצטרפות אורח לאירוע לפי טוקן הזמנה',
  'events/live/[token]': 'צפייה באירוע לפי טוקן הזמנה בכתובת',
  'events/[id]/join': 'הצטרפות אורח לאירוע לפי טוקן הזמנה',
  'surveys/submit': 'הגשת סקר על ידי תושב, ללא התחברות',
  'duty-form': 'טופס תורנות בקישור חתום (HMAC) שנשלח בוואטסאפ',
};

/**
 * ראוטים שלא מקבלים JSON - צריך לשלוח להם גוף בפורמט שלהם, אחרת הם
 * נופלים על פענוח הגוף עוד לפני בדיקת ההרשאה והבדיקה מודדת את הדבר הלא נכון.
 */
const BODY_OVERRIDES = {
  'events/upload': () => {
    const form = new FormData();
    form.set('file', new File(['x'], 'test.png', { type: 'image/png' }));
    form.set('event_id', FAKE_ID);
    return form;
  },
};

function findRoutes(dir, prefix = '') {
  const routes = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      routes.push(...findRoutes(full, prefix ? `${prefix}/${entry.name}` : entry.name));
    } else if (entry.name === 'route.js') {
      routes.push({ routePath: prefix, filePath: full });
    }
  }
  return routes;
}

// segments דינמיים ([id], [token]) מקבלים ערך מזויף
function paramsFor(routePath) {
  const params = {};
  for (const segment of routePath.split('/')) {
    const match = segment.match(/^\[(?:\.\.\.)?(.+)\]$/);
    if (match) params[match[1]] = FAKE_ID;
  }
  return params;
}

const routes = findRoutes(API_DIR);
const protectedRoutes = routes.filter((r) => !(r.routePath in PUBLIC_ROUTES));

describe('חוזה אבטחה: כל API route מוגן דורש אימות', () => {
  it('מצא את כל הראוטים בפרויקט', () => {
    expect(routes.length).toBeGreaterThan(60);
  });

  it('כל ראוט ברשימת הציבוריים אכן קיים בפרויקט', () => {
    const existing = new Set(routes.map((r) => r.routePath));
    const stale = Object.keys(PUBLIC_ROUTES).filter((p) => !existing.has(p));
    expect(stale, 'רשימת הראוטים הציבוריים מכילה נתיבים שכבר לא קיימים').toEqual([]);
  });

  describe.each(protectedRoutes)('$routePath', ({ routePath, filePath }) => {
    it('דוחה בקשה ללא אימות בכל שיטת HTTP שהוא מייצא', async () => {
      const mod = await import(/* @vite-ignore */ filePath);
      const exported = METHODS.filter((m) => typeof mod[m] === 'function');
      expect(exported.length, `${routePath} לא מייצא אף handler`).toBeGreaterThan(0);

      const params = paramsFor(routePath);
      const failures = [];

      for (const method of exported) {
        // ?id= כדי שראוטים שמוודאים פרמטרים לפני ההרשאה יגיעו לבדיקת ההרשאה עצמה
        const url = `/api/${routePath.replace(/\[[^\]]+\]/g, FAKE_ID)}?id=${FAKE_ID}`;
        const override = BODY_OVERRIDES[routePath];
        const request = makeRequest(url, {
          method,
          body: method === 'GET' ? undefined : override ? override() : {},
        });

        let status;
        try {
          const response = await mod[method](request, { params });
          status = response?.status;
        } catch (error) {
          failures.push(`${method}: קרס לפני בדיקת הרשאה (${error.message})`);
          continue;
        }

        if (status !== 401 && status !== 403) {
          failures.push(`${method}: החזיר ${status} במקום 401/403`);
        }
      }

      expect(failures, `/api/${routePath} חשוף ללא אימות`).toEqual([]);
    });
  });
});
