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

## ⚠️ מה נשאר פתוח בכוונה — והחלטות שממתינות לך

### 1. GET ציבורי לדפים ללא התחברות
הדפים `/screen`, `/on-call-query`, `/on-call`, `/duty-form` צורכים את ה-GET של:
`duty-roster`, `contacts`, `departments`, `security-daily-order`, `security-staff`, `call-center-schedule/current`, `notifications`, `vacations`, `war-mode`, `weather`, `duty-form`.
לכן GET נשאר פתוח שם. **החלטה נדרשת:** טוקן קבוע למסך המוקד (מומלץ) / דרישת התחברות / השארה פתוחה.

### 2. `security-daily-order/entry` — פתוח לגמרי (כולל כתיבה!)
מסך המוקד הציבורי `/screen` **שולח POST/PATCH** לנתיב הזה (שינויי משמרות מהמסך). אי אפשר לאבטח אותו בלי לשבור את המסך. יטופל יחד עם החלטת המסך.

### 3. `duty-roster` DELETE — פתוח
דף `/duty-form/[departmentId]` הציבורי (נשלח למנהלי מחלקות ב-WhatsApp) מוחק תורנויות. פתרון עתידי: קישור עם טוקן חתום במקום ID גלוי.

### 4. כתיבה ישירה ל-Supabase מהדפדפן
חלק מהדפים (למשל `sector-manager`) כותבים ישירות לטבלאות `contacts`/`duty_roster` עם ה-anon key — כלומר ה-RLS מאפשר כתיבה אנונימית. **צריך לתקן ברמת ה-RLS ב-Supabase** או להעביר את הכתיבות ל-API. נכון לעכשיו זו הדלת האחורית הגדולה שנותרה.

### 5. Events
נתיבי האירועים (`journal`, `upload`, `join`) נשארו כמו שהם — בנויים לאורחים עם טוקן אירוע. שלב הבא: לוודא שכל פעולה דורשת את טוקן האירוע ולא רק את ה-ID.

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
- סקירת RLS מלאה ב-Supabase (סעיף 4 ב"החלטות פתוחות" — **החשוב ביותר שנותר**)
- הסרת מנגנון `APP_PASSWORD`/`ADMIN_PASSWORD` הישן
- CSP (Content-Security-Policy) מלא — דורש מיפוי מקורות (Leaflet tiles, Supabase, fonts)

## איך לבדוק (רגרסיה)
1. התחברות כמוקדן → `/operator`: מדריך שיחות נטען, עדכונים יומיים, סטטוס מקלטים ניתן לשינוי, לחצני מצוקה, צ'אט AI עונה
2. התחברות כמנהלת מוקד → קטגוריות שיחה (עריכה), חופשות, סידור עבודה, מאגר ידע, סקרים
3. התחברות כמנהל מכלול → אנשי קשר, תורנויות, סידור ביטחון שבועי + פקודת יום
4. **בלי התחברות** → `/screen` מציג הכול, `/on-call-query` עובד, `/duty-form/[id]` שולח
5. בלי התחברות → ניסיון `POST /api/war-mode` (או כל כתיבה) מחזיר 401
