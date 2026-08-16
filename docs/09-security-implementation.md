# 09 — תיעוד יישום אבטחת ה-API

> מתעד את השינויים שבוצעו בפועל לפי [תוכנית העבודה (08)](./08-work-plan.md). עודכן: אוגוסט 2026.

## מה תוקן — שלב 1: תשתית (`lib/auth.js`)

### 1. תיקון `verifyAuth` — שורש הבעיה
לפני: הפונקציה קראה את הטוקן רק מ-header `Authorization: Bearer`, אבל הטוקן נמצא בעוגיית **HttpOnly** שהדפדפן לא יכול לצרף ידנית — ולכן האימות תמיד נכשל מהאפליקציה, וזו הסיבה שנוטרל בהערות.

אחרי: `verifyAuth` קורא קודם את עוגיית `auth-token`, ורק אם אין — מנסה header (לתאימות עם כלים חיצוניים).

### 2. Helper חדש: `requireRole`
כל route מגן על עצמו בשתי שורות אחידות:

```js
import { requireRole } from '@/lib/auth';

// בתוך ה-handler:
const auth = await requireRole(request, ['call_center_manager']);
if (auth.error) return auth.error;   // 401 אם לא מחובר, 403 אם אין תפקיד מתאים
// auth.user — פרטי המשתמש מה-JWT
```

כללים: `roles` ריק = כל משתמש מחובר; `admin` מורשה תמיד.

### 3. הסרת ברירת המחדל של `JWT_SECRET`
אם `JWT_SECRET` לא מוגדר — המערכת זורקת שגיאה במקום להשתמש בסוד גלוי. **חובה לוודא שהמשתנה מוגדר ב-Vercel.**

### 4. ניקוי `.env.example`
הוסרו סיסמאות אמיתיות שהיו בקובץ (שנמצא ב-git). ⚠️ **פעולה נדרשת ממך:** לשנות בפועל את `APP_PASSWORD` ו-`ADMIN_PASSWORD` (ב-Vercel וב-`.env.local`), כי הישנים נחשפו בהיסטוריית git.

## מה תוקן — שלב 2: החזרת האימות המנוטרל

| Route | GET | כתיבה |
|-------|-----|--------|
| `/api/call-categories` | כל מחובר | `call_center_manager` |
| `/api/call-categories/[id]/contacts` (+`unavailable`, `vacation`, `[contactId]`) | — | `call_center_manager` |
| `/api/daily-updates` | כל מחובר | POST: `operator`/`call_center_manager`; DELETE: `call_center_manager` |

הוסרו כל הערות ה-`TODO: Re-enable authentication after testing`.

## מה תוקן — שלב 3: אבטחת פעולות כתיבה (POST/PUT/PATCH/DELETE)

מדיniyut: בשלב זה אובטחו **כל פעולות הכתיבה**; פעולות קריאה (GET) נשארו פתוחות עד להכרעת סוגיית הדפים הציבוריים (ראה "החלטות פתוחות").

| Route | פעולות שאובטחו | תפקידים מורשים (בנוסף ל-admin) |
|-------|-----------------|--------------------------------|
| `security-schedule` (+bulk-insert), `security-shifts`, `security-staff`, `security-leave`, `security-settings`, `security-daily-order` | כל הכתיבות | `sector_manager`, `call_center_manager` |
| `call-center-staff`, `call-center-schedule` (+bulk-insert) | כל הכתיבות | `call_center_manager` |
| `knowledge-base`, `garbage-collection`, `on-call-contacts` (+`[id]`) | כל הכתיבות | `call_center_manager` |
| `notifications`, `panic-buttons`, `shelter-status`, `war-mode` | כל הכתיבות | `operator`, `call_center_manager` |
| `departments`, `contacts`, `duty-roster` (POST/PATCH) | כתיבות | `call_center_manager`, `sector_manager` |
| `knowledge-chat` | POST | כל משתמש מחובר (עולה כסף ב-OpenAI) |

## מה תוקן — שלב 5: סגירת ההחלטות הפתוחות (אוגוסט 2026)

### 1. ✅ מסך המוקד — טוקן קבוע (`SCREEN_TOKEN`)
מומשה אפשרות ב' מתוכנית העבודה:
- **גישה למסך:** `/screen?key=<SCREEN_TOKEN>` — ה-middleware מזהה את המפתח, קובע עוגיית `screen-key` (HttpOnly, שנה) ומנקה את ה-key מה-URL. בכניסות הבאות העוגייה מספיקה. משתמש מחובר יכול לצפות במסך גם בלי מפתח. בלי אף אחד מהשניים → הפניה ל-login.
- **API:** helper חדש `requireRoleOrScreen(request, roles)` ב-`lib/auth.js` — מכבד טוקן מסך (השוואה קבועת-זמן) או משתמש מחובר. הוחל על ה-GET של: `security-daily-order` (+`entry`), `security-staff`, `duty-roster`, `contacts`, `departments`, `call-center-schedule/current`, `vacations`, `notifications`, `war-mode`.
- **`security-daily-order/entry`** — ה-POST/PATCH (שינויי משמרות מהמסך) דורשים עכשיו טוקן מסך או תפקיד `operator`/`call_center_manager`/`sector_manager`. ה-GET דורש טוקן מסך או התחברות.
- **פעולה נדרשת:** להגדיר `SCREEN_TOKEN` ב-Vercel (נוצר אוטומטית ב-`.env.local`) ולעדכן את הקישור השמור במחשב של מסך המוקד ל-`/screen?key=...` (פעם אחת).

### 2. ✅ `/on-call` + `/on-call-query` — דורשים התחברות
נוספו ל-middleware (כל תפקיד מחובר). חושפים טלפונים של עובדים — מוקדנים ממילא מחוברים.

### 3. ✅ `duty-form` — קישור עם טוקן חתום
- helper חדש `signDutyFormToken(departmentId)` — HMAC-SHA256 עם `DUTY_FORM_SECRET` (env חדש). הטוקן קבוע פר-מכלול (קישורי WhatsApp לא פגים).
- הקישורים שנשלחים ב-WhatsApp (`WhatsAppDutyLinks`) הם עכשיו `/duty-form/<id>?t=<token>`; הטוקנים מגיעים מ-endpoint חדש `/api/duty-form/links` (למנהלים מחוברים בלבד).
- `/api/duty-form` GET/POST ו-`/api/duty-roster` DELETE דורשים את הטוקן (או משתמש מחובר). ב-DELETE הטוקן מאומת מול המכלול שאליו שייכת התורנות.
- **שים לב:** קישורים ישנים בלי `?t=` שכבר נשלחו למנהלים — יפסיקו לעבוד. יש לשלוח קישורים חדשים.

### 4. ✅ סגירת הכתיבה הישירה ל-Supabase מהדפדפן
- **`sector-manager`** — כל 7 הכתיבות הישירות (`contacts`, `duty_roster`) הועברו ל-API המאומת. `/api/duty-roster` הורחב: הוספה מרובה (`entries`), מחיקת כוננות קבועה (`?permanent=true`), ו-`week_start_date` בעדכון.
- **כל ה-API routes (62 קבצים)** עברו מ-anon key ל-`SUPABASE_SERVICE_ROLE_KEY` (עם fallback ל-anon אם לא מוגדר). גם ה-middleware (בדיקת השעיה).
- **מיגרציית RLS חדשה:** `supabase/migrations/20260813_rls_anon_lockdown.sql` — קריאה-בלבד ל-anon בטבלאות שהדפדפן קורא (כולל realtime של מסך המוקד), עמודות בטוחות בלבד ב-`user_profiles`, חסימה מלאה לכל השאר. **יש להריץ ב-SQL Editor רק אחרי פריסת הקוד** (אחרת ה-API ייחסם), ולוודא ש-`SUPABASE_SERVICE_ROLE_KEY` מוגדר ב-Vercel.

### 5. ⚠️ Events — נשאר פתוח בכוונה (הפריט האחרון)
דפי האירועים (`events/[id]`, `event/live/[token]`) עדיין כותבים ישירות ל-`emergency_events`/`event_journal`/`event_participants` עם ה-anon key — by-design לאורחים עם טוקן אירוע. במיגרציית ה-RLS הטבלאות האלה נשארו פתוחות (מדיניות `anon_full_temp`). שלב הבא: להעביר את הכתיבות ל-API שמאמת את טוקן האירוע, ואז לסגור גם אותן.

## מה תוקן — שלב 4: הקשחות

### Rate limiting (`lib/rate-limit.js`)
Limiter בזיכרון לפי IP (sliding window), הוחל על:
| Endpoint | מגבלה |
|----------|--------|
| `POST /api/auth/login` | 10 לדקה |
| `POST /api/auth/register` | 5 לדקה |
| `POST /api/surveys/submit` | 5 לדקה |
| `POST /api/knowledge-chat` | 20 לדקה (אחרי אימות) |

הערה: ב-Vercel המונה הוא per-instance — הגנה בסיסית נגד brute-force. לשדרוג עתידי: Upstash Redis.

### העלאת תמונות (`/api/events/upload`)
- כבר היו: בדיקת `image/*` ומקסימום 10MB
- נוסף: סניטציה של `event_id` בנתיב הקובץ (מניעת path traversal) + whitelist לסיומות

### Security headers (`next.config.js`)
`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` — על כל הדפים.

## מה עוד לא בוצע
- **ריפקטור Events** (סעיף 5 למעלה — הפריט המשמעותי שנותר): העברת כתיבות דפי האירועים ל-API עם אימות טוקן אירוע + סגירת ה-RLS על טבלאות האירועים
- **הרצת מיגרציית ה-RLS בפועל** ב-Supabase (אחרי פריסת הקוד) + הגדרת `SCREEN_TOKEN` ו-`DUTY_FORM_SECRET` ב-Vercel
- אימות קלט (הגבלת אורך + סניטציה) בנקודות טקסט חופשי (journal, notifications, knowledge-base)
- CSP (Content-Security-Policy) מלא — דורש מיפוי מקורות (Leaflet tiles, Supabase, fonts)

## איך לבדוק (רגרסיה)
1. התחברות כמוקדן → `/operator`: מדריך שיחות נטען, עדכונים יומיים, סטטוס מקלטים ניתן לשינוי, לחצני מצוקה, צ'אט AI עונה
2. התחברות כמנהלת מוקד → קטגוריות שיחה (עריכה), חופשות, סידור עבודה, מאגר ידע, סקרים; קישורי WhatsApp לטפסים כוללים `?t=`
3. התחברות כמנהל מכלול → אנשי קשר (הוספה/מחיקה), תורנויות (הוספה/עריכה/מחיקה/כונן קבוע), סידור ביטחון שבועי + פקודת יום — הכול דרך ה-API עכשיו
4. **בלי התחברות** → `/screen` מפנה ל-login; `/screen?key=<SCREEN_TOKEN>` מציג הכול כולל עדכוני realtime, ושינוי משמרת מהמסך עובד
5. בלי התחברות → `/on-call`, `/on-call-query` מפנים ל-login
6. `/duty-form/<id>` בלי `?t=` → שגיאת "קישור לא תקין"; עם הטוקן מהקישור החדש → נטען, שומר ומוחק
7. בלי התחברות → ניסיון `POST /api/war-mode` או `GET /api/contacts` מחזיר 401
8. אחרי הרצת מיגרציית ה-RLS: כתיבה ישירה עם ה-anon key (למשל מ-console בדפדפן: `supabase.from('contacts').insert(...)`) נכשלת, ומסך המוקד עדיין מקבל עדכונים חיים
