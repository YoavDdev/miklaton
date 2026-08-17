import { vi } from 'vitest';

/**
 * מוק ל-@supabase/supabase-js: שרשרת קריאות אינסופית שתמיד מסתיימת ב-
 * { data: [], error: null }. המטרה היחידה היא שבדיקות לא ייגעו ברשת.
 * אם ראוט מגיע עד השאילתה - סימן שהוא לא נעצר בבדיקת ההרשאה, וזה בדיוק
 * מה שבדיקת חוזה האבטחה אמורה לתפוס.
 */
function createChainable() {
  const target = function () {
    return createChainable();
  };
  return new Proxy(target, {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve) => resolve({ data: [], error: null, count: 0 });
      }
      if (prop === Symbol.toPrimitive || prop === 'toJSON') return undefined;
      return createChainable();
    },
    apply() {
      return createChainable();
    },
  });
}

export function mockSupabase() {
  vi.mock('@supabase/supabase-js', () => ({
    createClient: () => createChainable(),
  }));
}

export { createChainable };
