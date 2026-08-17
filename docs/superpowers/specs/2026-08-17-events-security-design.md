# עיצוב: אבטחת מערכת אירועי החירום (Events Refactor)

> נכתב: 2026-08-17. סוגר את סעיף 4.2 בתוכנית העבודה ([08-work-plan.md](../../08-work-plan.md)) — הפריט האבטחתי הפתוח האחרון.

## רקע והבעיה

מערכת האירועים נבנתה לעבודה משותפת של מוקדנים (מחוברים) ואורחים מהשטח (קישור הזמנה עם טוקן), אך כיום:

1. **API פתוח לחלוטין** — `GET /api/events` מחזיר לכל גולש אנונימי את כל האירועים כולל `invite_token` (הסוד עצמו); `GET /api/events/[id]` חושף מספרי טלפון של משתתפים; `POST .../journal` מאפשר כתיבה והתחזות לכל אחד (הזהות מגיעה מה-body); `POST .../[id]/join` מאפשר לצרף משתמש שרירותי לאירוע; `upload` פתוח לכולם.
2. **כתיבות ישירות מהדפדפן** — דף המוקדן (`app/events/[id]/page.js`) ודף האורח (`app/event/live/[token]/page.js`) קוראים וכותבים ישירות ל-Supabase עם ה-anon key (עדכון מפה, נעיצה, סימון משימות, מחיקת סמנים, סטטוס שטח), ומשתמשים ב-Realtime עם מנוי על **כל** הטבלה.
3. **RLS פתוח** — בגלל (2), המיגרציה `20260813_rls_anon_lockdown.sql` השאירה את `emergency_events`, `event_journal`, `event_participants` עם policy `anon_full_temp` (הכל מותר ל-anon).
4. **טוקן חלש** — נוצר עם `Math.random()` (לא קריפטוגרפי); אין rate limiting על ניחוש טוקנים ב-`/api/events/join`.
5. **Storage פתוח** — ל-bucket `event-images` יש policy העלאה ציבורית ישירה.

## החלטות מוצר (סוכמו עם המשתמש)

- **Realtime נזנח לטובת polling** — שני הדפים כבר עושים polling כל 10 שניות; מוותרים על מנויי Realtime לגמרי כדי לסגור RLS לחלוטין.
- **אורח מאומת-טוקן שומר על מלוא היכולות** — יומן, תמונות, סימון משימות, עריכת מפה, מחיקת סמנים. ההבדל: הכל דרך API שמאמת טוקן וזהות בצד השרת.
- **גישה א' נבחרה** — טוקן האירוע כ-credential ב-API (ולא JWT אורח ולא אבטחת-כתיבות-בלבד).
- **קישורי הזמנה קיימים ממשיכים לעבוד** — אין רוטציית טוקנים לאירועים קיימים.

## 1. שכבת האימות — `lib/auth.js`

### `requireEventAccess(request, eventId)`

שער אחיד לכל route של אירוע, באותו דפוס כמו `requireRole`:

- טוען את האירוע (service role). לא נמצא → `{ error: 404 }`.
- **מסלול משתמש מחובר:** `verifyAuth(request)` תקף → `{ user, event }`.
- **מסלול אורח:** header בשם `X-Event-Token` תואם את `event.invite_token` בהשוואת `safeCompare` (timing-safe) → `{ guest: true, event }`.
- אחרת → `{ error: 401 }`.

ה-route מקבל את האירוע כבר טעון — בלי שליפה כפולה. פעולות כתיבה בודקות בנוסף `event.status !== 'closed'` (חוץ מסגירת האירוע עצמה).

### זהות אורח בצד השרת

אורח שכותב ליומן שולח רק `participant_id`. השרת מאמת שהמשתתף שייך ל-`event_id` ולוקח `author_name` / `author_role` / `author_field_status` **מרשומת המשתתף** — לא מה-body. משתמש מחובר: הזהות נלקחת מה-JWT + `user_profiles` (כמו ב-`POST /api/events` כיום).

### יצירת טוקנים

`generateToken` עובר ל-`crypto.randomBytes` עם מיפוי לאלפבית base62-ללא-תווים-דו-משמעיים, אורך 16. עובר ל-`lib/auth.js` (או מודול עזר) כדי שלא ישוכפל.

## 2. שינויי API

| Route | שינוי |
|---|---|
| `GET /api/events` | דורש התחברות (`requireRole([])`). משמש רק דפים מחוברים (רשימת אירועים, באנר). |
| `POST /api/events` | עובר ל-`requireRole([])` במקום אימות ידני; טוקן קריפטוגרפי. |
| `PATCH`/`DELETE /api/events` | עוברים ל-helpers האחידים; לוגיקת ההרשאות הקיימת (יוצר/אדמין) נשמרת. |
| `GET /api/events/[id]` | `requireEventAccess`. לאורח — משתתפים ללא `phone`/`guest_phone`. |
| `POST /api/events/[id]/journal` | `requireEventAccess` + זהות מהשרת + הגבלת אורך `content` (5000 תווים). |
| **חדש** `PATCH /api/events/[id]/journal/[entryId]` | נעיצה (`is_pinned`), סימון משימה (`task_status`, `assigned_to`). `requireEventAccess`. |
| **חדש** `DELETE /api/events/[id]/journal/[entryId]` | מחיקת רשומות `map_marker` בלבד. `requireEventAccess`. |
| **חדש** `PATCH /api/events/[id]/participants/[pid]` | עדכון `field_status` / `display_name`. `requireEventAccess` + המשתתף שייך לאירוע. |
| `GET`/`PUT /api/events/[id]/map-data` | `requireEventAccess` (אורח מורשה). |
| `POST /api/events/[id]/join` | דורש התחברות (`requireRole([])`) — מסלול הצטרפות של משתמשים מחוברים; `user_id` נלקח מה-JWT, לא מה-body. אורחים מצטרפים דרך `POST /api/events/join` עם טוקן. |
| `POST /api/events/join` | נשאר ציבורי (הטוקן הוא האישור) + **rate limiting** (`lib/rate-limit.js`) + מחזיר רק שדות נחוצים מהאירוע (`id`, `title`, `severity`, `status`, `event_type`, `created_at`) — לא את השורה המלאה. |
| `POST /api/events/upload` | `requireEventAccess` + האירוע קיים ופעיל. |
| **חדש** `GET /api/events/live/[token]` | נקודת הקצה של דף האורח: מאתרת אירוע לפי טוקן (timing-safe), מחזירה אירוע + יומן + משתתפים מסוננים (ללא טלפונים) + `myParticipant` לפי `?phone=`. Rate limited. |

כל ה-routes ממשיכים לעבוד עם service role; ולידציית קלט בסיסית (אורך שדות טקסט) נוספת בנקודות הכתיבה.

## 3. הדפים — הסרת Supabase מהדפדפן

### `app/events/[id]/page.js` (קונסולת מוקדן)

- מחיקת ה-client של Supabase והמנויים ל-Realtime.
- קריאות: `GET /api/events/[id]` ב-polling של 10 שניות (המנגנון הקיים).
- כתיבות: כל הכתיבות הישירות (מפה ×8, נעיצה, משימות, מחיקת סמנים, `display_name`, `field_status`, `summary`) עוברות ל-endpoints מהטבלה למעלה.

### `app/event/live/[token]/page.js` (דף אורח)

- מחיקת ה-client של Supabase והמנויים.
- קריאות: `GET /api/events/live/[token]?phone=` ב-polling של 10 שניות.
- כתיבות: כל בקשה שולחת `X-Event-Token: <token>` (הטוקן כבר נמצא ב-URL של הדף).
- זיהוי "המשתתף שלי" מגיע מהשרת (`myParticipant`) במקום התאמת טלפון בצד לקוח.

### `components/ActiveEventBanner.js` (כל הדשבורדים)

- מחיקת ה-client והמנויים; מעבר ל-`GET /api/events?status=active` ב-polling של 30 שניות (הדשבורדים מחוברים תמיד).

לאחר השינוי — אף קובץ במערכת האירועים לא מייבא `@supabase/supabase-js` בצד לקוח.

## 4. Supabase — מיגרציה חדשה

`supabase/migrations/20260817_events_rls_lockdown.sql`:

1. הסרת policies `anon_full_temp` מ-`emergency_events`, `event_journal`, `event_participants` → RLS מופעל עם אפס policies (נעילה מלאה ל-anon, כמו סעיף 4 במיגרציית הנעילה הקודמת).
2. Storage: הסרת policy ההעלאה הציבורית `"Allow upload event images"` מ-bucket `event-images` (העלאה רק דרך ה-API עם service role). קריאה ציבורית נשארת — הקישורים ביומן מוצגים לאורחים.
3. הסרת שלוש הטבלאות מ-publication `supabase_realtime` (כבר לא בשימוש).

המיגרציה תרוץ ב-Supabase **אחרי** פריסת הקוד (הסדר קריטי — הקוד החדש לא תלוי ב-RLS פתוח, אבל הקוד הישן כן).

## 5. לא בהיקף

- אין Supabase Auth ואין JWT לאורחים.
- אין תפוגה או רוטציה לטוקן אירוע — אירוע סגור חוסם כתיבה (קיים היום), וזה מודל הסיכון המקובל לקישור הזמנה.
- אין שינוי בחוויית ההצטרפות של אורח (אותו קישור, אותה זרימת טלפון).
- אין העברת קריאת התמונות ב-Storage למאובטח — קריאה ציבורית של תמונות נשארת.
- `middleware.js` לא משתנה — `/event/live` ו-`/event/join` נשארים ציבוריים בכוונה.

## 6. בדיקות רגרסיה

1. יצירת אירוע מדשבורד מוקדן; ודא טוקן חדש באורך 16.
2. קונסולת מוקדן: כתיבה ביומן, העלאת תמונה, נעיצה, סימון משימה, עריכת מפה (מיקום + חסימה), מחיקת סמן, עדכון סטטוס שטח.
3. קישור הזמנה: הצטרפות אורח בטלפון, זיהוי נכון של המשתתף, כל הפעולות מסעיף 2 כאורח.
4. `ActiveEventBanner` מציג אירוע פעיל בכל הדשבורדים.
5. סגירת אירוע (עם סיכום) → כתיבת אורח נחסמת (403).
6. שלילי: `GET /api/events` בלי עוגייה → 401; `POST journal` בלי טוקן → 401; קריאת `emergency_events` ישירה עם anon key → 0 שורות; העלאה ישירה ל-bucket → נדחית.
