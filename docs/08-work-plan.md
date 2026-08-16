# 08 — תוכנית עבודה: אבטחת API ושיפור המערכת

> נכתב: אוגוסט 2026. מבוסס על סקירת עומק של כל 68 קבצי ה-route, ה-middleware וה-DB.

---

# חלק א' — אבטחת ה-API

> ✅ שלבים 1-2 בוצעו במלואם; שלב 3 בוצע לכל פעולות הכתיבה. פירוט: [09-security-implementation.md](./09-security-implementation.md)

## 🔍 אבחון: למה האימות מנוטרל?

זה **שורש הבעיה** וחשוב להבין אותו לפני התיקונים:

במערכת יש שתי דרכים לאמת בקשה:

| דפוס | איך עובד | סטטוס |
|------|-----------|--------|
| **עוגייה** — `request.cookies.get('auth-token')` + `verifyToken()` | הדפדפן שולח את העוגייה אוטומטית | ✅ עובד (בשימוש ב-operator/tasks, events, surveys...) |
| **Header** — `verifyAuth(request)` קורא `Authorization: Bearer` | הטוקן בעוגיית **HttpOnly** — ה-JS בדפדפן לא יכול לקרוא אותו ולשלוח כ-header | ❌ תמיד נכשל מהדפדפן |

לכן ב-routes שהשתמשו ב-`verifyAuth` (כמו `call-categories`) האימות "נוטרל זמנית לבדיקות" (`TODO: Re-enable authentication after testing`) — כי הוא פשוט חסם את האפליקציה עצמה.

**התיקון הנכון:** לעדכן את `verifyAuth` ב-`lib/auth.js` לקרוא קודם מהעוגייה (ואז fallback ל-header), ואז להחזיר את האימות בכל מקום — בלי לשבור שום דבר בפרונט.

## 📋 מיפוי מצב נוכחי (68 routes)

| קטגוריה | routes | דוגמאות |
|----------|--------|----------|
| ✅ מאומתים כראוי (עוגייה) | ~22 | auth/*, admin/users/*, operator/*, tasks, surveys, events (כתיבה), profile |
| ⚠️ אימות קיים אך מנוטרל בהערה | ~8 | call-categories/* (כל התתי-נתיבים), daily-updates (GET/POST) |
| ❌ ללא אימות בכלל — **כתיבה** | ~25 | security-* (הכול!), departments, contacts, duty-roster, on-call-contacts, shelter-status, panic-buttons, war-mode, knowledge-base, garbage-collection, notifications, call-center-* |
| 🌐 ציבורי בכוונה | ~13 | login/register, surveys/submit, events/join (טוקן), weather, shabbat-times, version, geocode, duty-form (ראה החלטה למטה) |

## שלב 1 — תשתית (חצי יום עבודה) 🔴 קריטי

- [x] **1.1 תיקון `verifyAuth` ב-`lib/auth.js`** — קריאת הטוקן מהעוגייה `auth-token` קודם, ואז מ-header (לתאימות). זו התשתית לכל השאר.
- [x] **1.2 הוספת helper לבדיקת תפקיד** — למשל `requireRole(request, ['admin', 'call_center_manager'])` שמחזיר את המשתמש או תשובת 401/403 — כדי שכל route יגן על עצמו בשורה אחת אחידה.
- [x] **1.3 הסרת ה-fallback של `JWT_SECRET`** — במקום ברירת מחדל, לזרוק שגיאה אם המשתנה לא מוגדר. לוודא שהוא מוגדר ב-Vercel.
- [x] **1.4 סיבוב סודות שנחשפו:** *(הקובץ נוקה — נותר לשנות את הסיסמאות בפועל!)*
  - `.env.example` מכיל סיסמאות אמיתיות (`APP_PASSWORD`, `ADMIN_PASSWORD`) שנמצאות ב-git — להחליף לערכי דוגמה **ולשנות את הסיסמאות בפועל**.
  - מומלץ גם לחדש את `JWT_SECRET` (ינתק את כולם פעם אחת — לתאם).

## שלב 2 — החזרת אימות ל-routes המנוטרלים (חצי יום) 🔴

אחרי שלב 1.1 אפשר פשוט להסיר את ההערות:

- [x] `call-categories/route.js` — GET מאומת לכל מחובר; POST/PUT/DELETE ל-`call_center_manager`+`admin`
- [x] `call-categories/[id]/contacts/*` (4 קבצים) — כנ"ל
- [x] `daily-updates/route.js` — GET לכל מחובר; POST/PUT/DELETE לפי התפקידים שכבר מוגדרים ב-PUT/DELETE

## שלב 3 — הוספת אימות ל-routes הפתוחים (1-2 ימים) 🔴

מדיניות מוצעת (קריאה = כל משתמש מחובר, כתיבה = לפי תפקיד):

| Routes | קריאה (GET) | כתיבה (POST/PUT/PATCH/DELETE) |
|--------|--------------|-------------------------------|
| `security-*` (8 קבצים) | מחובר | `sector_manager`, `admin` (+`call_center_manager` לצפייה) |
| `call-center-staff`, `call-center-shifts`, `call-center-schedule/*` | מחובר | `call_center_manager`, `admin` |
| `departments`, `contacts` | מחובר | `admin`, `call_center_manager`, `sector_manager` |
| `duty-roster`, `on-call-contacts/*` | מחובר | `call_center_manager`, `sector_manager`, `admin` |
| `knowledge-base` | מחובר | `call_center_manager`, `admin` |
| `garbage-collection` | מחובר | `admin`, `call_center_manager` |
| `notifications` | מחובר | `call_center_manager`, `admin` |
| `panic-buttons` | מחובר | `call_center_manager`, `admin` |
| `shelter-status` | מחובר | `operator`, `call_center_manager`, `admin` |
| `war-mode` | מחובר | `call_center_manager`, `admin` בלבד! |
| `vacations`, `user-departments`, `municipalities` | מחובר | — |
| `knowledge-chat` | מחובר (עולה כסף ב-OpenAI!) | — |
| `events/[id]/journal`, `events/upload`, `events/[id]` | ראה החלטה 4.2 | |

### ⚠️ החלטות מוצרים שצריך לקבל (לא רק קוד)

- [x] **4.1 דפים ציבוריים שניזונים מ-API פתוח:** ✅ בוצע (אוגוסט 2026):
  - `/screen` — מומש טוקן קבוע (`SCREEN_TOKEN`, אפשרות ב'): `?key=` פעם אחת ⇒ עוגייה, וה-GET-ים + כתיבת המשמרות מכבדים אותו (`requireRoleOrScreen`).
  - `/on-call`, `/on-call-query` — נכנסו ל-middleware (דורשים התחברות).
  - `/duty-form/[departmentId]` — קישור עם טוקן חתום (HMAC, `DUTY_FORM_SECRET`) במקום ID גלוי.
- [ ] **4.2 אירועי חירום** — `event/live/[token]` בנוי לאורחים דרך טוקן. לוודא שכל ה-API של האירועים דורש לפחות את הטוקן של האירוע (ולא פתוח לכל מזהה אירוע), במיוחד `events/[id]` (GET), `journal`, `upload`. **הפריט הפתוח האחרון** — כולל העברת הכתיבות הישירות של דפי האירועים ל-API וסגירת ה-RLS על טבלאות האירועים.

## שלב 4 — הקשחות נוספות (יום) 🟡

- [x] **Rate limiting** על `login`, `register`, `knowledge-chat`, `surveys/submit` (למשל `@upstash/ratelimit` או פתרון פשוט בזיכרון per-IP).
- [ ] **אימות קלט** — נקודות שמקבלות טקסט חופשי שמוצג לאחרים (journal, notifications, knowledge-base): הגבלת אורך + סניטציה.
- [x] **`events/upload`** — הגבלת סוג קובץ (תמונות בלבד) וגודל + סניטציית נתיב.
- [x] **RLS ב-Supabase** — ✅ בוצע (אוגוסט 2026): כל ה-routes עברו ל-service role, הכתיבות הישירות של `sector-manager` הועברו ל-API, ונכתבה מיגרציה `20260813_rls_anon_lockdown.sql` (anon = קריאה בלבד; טבלאות אירועים נשארו פתוחות עד ריפקטור Events). **נותר: להריץ את המיגרציה ב-Supabase אחרי פריסה.**
- [x] **Security headers** ב-`next.config.js` — `X-Frame-Options`, `Content-Security-Policy` בסיסי.
- [x] **מחיקת מנגנון הסיסמאות הישן** — ✅ נמחקו `verifyOperatorPassword`/`verifyAdminPassword` (לא היו בשימוש). יש למחוק את `APP_PASSWORD`/`ADMIN_PASSWORD` גם מ-Vercel ומ-`.env.local`.

## סדר ביצוע מומלץ ובדיקות

```
יום 1: שלב 1 (תשתית) + שלב 2 (החזרת מנוטרלים) → בדיקת רגרסיה מלאה
יום 2-3: שלב 3 (routes פתוחים) — קבוצה-קבוצה, בדיקה אחרי כל קבוצה
יום 4: החלטות מוצר (מסך, טפסים) + שלב 4 (הקשחות)
```

בדיקת רגרסיה אחרי כל שלב: התחברות בכל תפקיד → מסך מוקדן מלא (מדריך שיחות, תורנויות, משימות) → מנהלת מוקד (קטגוריות, סידור) → מנהל מכלול (ביטחון) → `/screen` → טופס תורנות → סקר.

---

# חלק ב' — תוכנית שיפור המערכת

## עדיפות 1 — תיקוני יציבות ונכונות 🔴

| # | משימה | פירוט | מאמץ |
|---|--------|-------|-------|
| 1.1 | **דוחות פיקוח → Supabase** | `/api/inspection` כותב ל-`data/inspectionReports.json` — **לא עובד ב-Vercel** (מערכת קבצים זמנית). ליצור טבלת `inspection_reports` ולהעביר | 2-3 שעות |
| 1.2 | **redirect אחרי החלפת סיסמה** | `app/change-password/page.js` מפנה תמיד ל-`/operator` — להפנות לפי תפקיד | 15 דק' |
| 1.3 | **איחוד redirect של אדמין** | login/dashboard מפנים ל-`/admin/users`, middleware ל-`/admin` — לבחור אחד | 15 דק' |
| 1.4 | **איחוד מדיניות סיסמה** | `/api/profile/change-password` דורש 6 תווים, `/api/auth/change-password` דורש 8+מורכבות — לאחד ל-8 | 15 דק' |
| 1.5 | **קיצורי דרך שבורים בדשבורד** | `/ceo/teams`, `/operator/search` ועוד לא קיימים — להסיר או לממש | 30 דק' |
| 1.6 | **`mustChangePassword` ב-JWT** | ה-middleware בודק שדה שלא תמיד נחתם בטוקן — ליישר | 30 דק' |

## עדיפות 2 — סדר בבסיס הנתונים 🟠

| # | משימה | פירוט | מאמץ |
|---|--------|-------|-------|
| 2.1 | **איחוד מיגרציות** | להעביר את קבצי ה-CREATE מ-`scripts/` ל-`supabase/migrations/` עם שמות מתוארכים; לארכב את `20260511_remove_oncall_tables.sql` (מסוכנת) ואת הכפילות `20260510_add_daily_operations.sql` | חצי יום |
| 2.2 | **מסמך סדר הרצה מלא** | לעדכן את `supabase/RUN_MIGRATIONS_ORDER.md` שיכסה את הכול (כיום רק קטגוריות) — קריטי אם תרצה עירייה שנייה | שעה |
| 2.3 | **טבלאות ישנות** | `operator_shifts`, `shift_messages` — לבדוק שימוש אמיתי ולהחליט אם למחוק | שעה |

## עדיפות 3 — השלמת פיצ'רים חסרים 🟡

| # | משימה | פירוט |
|---|--------|-------|
| 3.1 | **דשבורד מנכ"ל אמיתי** | `/ceo` מציג נתוני דמו — לחבר לנתונים אמיתיים: אירועים פעילים, מצב מוקד, סטטיסטיקות פניות |
| 3.2 | **דשבורד פקח** | `/inspector` על דמו — לחבר למשימות אמיתיות (operator_tasks או טבלה ייעודית) ולדוחות פיקוח (אחרי 1.1) |
| 3.3 | **דשבורד אחראי מקלטים** | `/shelter-manager` על דמו — לחבר ל-shelter_status ולנתוני `shelters.json`; לשקול העברת המקלטים ל-DB |
| 3.4 | **מקלטים ל-DB** | `data/shelters.json` הוא מקור האמת אבל עריכה דורשת deploy — להעביר לטבלת `shelters` עם ממשק עריכה לאדמין |

## עדיפות 4 — חוויית שימוש ותפעול 🟢

| # | משימה | פירוט |
|---|--------|-------|
| 4.1 | **ניקוי קוד מת** | מחיקת הקומפוננטות הלא-בשימוש (רשימה ב-07-maintenance.md) — מפחית בלבול |
| 4.2 | **עדכון Next.js** | 14.0.0 היא גרסה ישנה עם CVEs ידועים — לעדכן לפחות ל-14.2.x האחרון (שינוי קטן, לא מעבר ל-15) |
| 4.3 | **לוג ביקורת (audit_log)** | הטבלה קיימת אבל רק חלק מהפעולות נרשמות — להרחיב לפעולות רגישות (מחיקות, שינויי תפקיד, war-mode) |
| 4.4 | **ניטור שגיאות** | אין כלי ניטור — לשקול Sentry (חינם לפרויקט קטן) כדי לדעת על תקלות אצל מוקדנים |
| 4.5 | **בדיקות אוטומטיות** | אין אף בדיקה בפרויקט — להתחיל בבדיקות API בסיסיות (אימות והרשאות) שירוצו לפני deploy |
| 4.6 | **PWA / מובייל** | מוקדנים ומנהלי מחלקות בנייד — לשפר רספונסיביות בדפים המרכזיים ולהוסיף manifest |

## לוח זמנים מוצע

| שבוע | מיקוד |
|-------|--------|
| שבוע 1 | חלק א' שלבים 1-3 (אבטחת API) + תיקוני עדיפות 1 → **ואז מעבר לדומיין miklaton.co.il** |
| שבוע 2 | חלק א' שלב 4 (הקשחות) + עדיפות 2 (סדר DB) |
| שבוע 3-4 | עדיפות 3 (השלמת דשבורדים) |
| שוטף | עדיפות 4 לפי הצורך |

> 💡 **המלצה מרכזית:** לבצע את אבטחת ה-API (חלק א' שלבים 1-3) **לפני** פרסום הדומיין הציבורי. כיום הכתובת ב-vercel.app פחות חשופה; ברגע שיש דומיין עירוני רשמי, המערכת תימצא ותיסרק.
