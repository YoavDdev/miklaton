import { createClient } from '@supabase/supabase-js';

/**
 * לקוח Supabase יחיד לצד השרת, עם service role.
 *
 * למה זה קיים: 45 ראוטים יצרו לקוח משלהם עם
 * `SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY`. ה-`||` הזה
 * אומר שאם משתנה הסביבה חסר - בסביבת preview, בהגדרה שגויה, במכונה חדשה -
 * הראוט ממשיך לרוץ עם המפתח הציבורי במקום להיכשל. הוא לא קורס ולא מתריע,
 * אלא מתחזה לתקין ומחזיר שגיאות הרשאה מוזרות שקשה מאוד לאבחן (YOA-21).
 *
 * כאן חסר מפתח נכשל מיד ובקול, עם הודעה שאומרת בדיוק מה חסר.
 *
 * שים לב: זה **לא** הלקוח לאימות סיסמאות. `signInWithPassword` ו-`signUp`
 * משנים את התפקיד של הלקוח שעליו הם נקראים, ולכן הם חייבים לקוח זמני עם
 * המפתח הציבורי - ראה `app/api/auth/login/route.js`.
 */

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. ראוטי ה-API דורשים service role; בלעדיו הם ייכשלו בהרשאות.`
    );
  }
  return value;
}

export const supabase = createClient(
  requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY')
);
