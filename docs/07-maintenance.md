# 07 — תחזוקה ובעיות ידועות

מסמך זה מרכז את מה שנמצא בסקירה מקיפה של המערכת (אוגוסט 2026) — דברים שכדאי לתקן, קבצים ישנים, ואי-עקביות.

## 🔴 אבטחה — מומלץ לטפל לפני חשיפה בדומיין ציבורי

1. **routes רבים ללא אימות** — רוב ה-API של ביטחון, תורנויות, מחלקות, אנשי קשר, מקלטים ולחצני מצוקה פתוחים לגמרי (🌐 ב-[03-api.md](./03-api.md)). בחלקם האימות קיים בקוד אך **מנוטרל בהערה** (`call-categories`, `daily-updates`). כשהמערכת עולה לדומיין ציבורי — כל מי שמכיר את הכתובת יכול לקרוא/לשנות נתונים.
2. **דפים ציבוריים עם מידע רגיש** — `/on-call`, `/on-call-query`, `/screen` חושפים שמות וטלפונים של עובדים ללא התחברות. יש להחליט אם זה מכוון (למשל למסך המוקד) ולהגן על השאר.
3. **JWT_SECRET עם ברירת מחדל** — `lib/auth.js` נופל ל-`'your-secret-key-change-in-production'` אם המשתנה לא מוגדר. לוודא שהוא מוגדר ב-Vercel, ועדיף להסיר את ה-fallback.
4. **`.env.example` מכיל סיסמאות אמיתיות** — `APP_PASSWORD` ו-`ADMIN_PASSWORD` אמיתיים מופיעים בקובץ שנמצא ב-git. להחליף לערכי דוגמה ולסובב את הסיסמאות.
5. **אין rate limiting** על login/register.

## 🟡 אי-עקביות בקוד

| בעיה | מיקום | פירוט |
|------|--------|-------|
| מדיניות סיסמה כפולה | `/api/auth/change-password` (8 תווים+מורכבות) מול `/api/profile/change-password` (6 תווים) | לאחד ל-8+ |
| redirect אחרי החלפת סיסמה | `app/change-password/page.js` | תמיד מפנה ל-`/operator`, גם למי שאינו מוקדן |
| redirect של אדמין | login API ו-dashboard מפנים ל-`/admin/users`; middleware ל-`/admin` | לאחד |
| קיצורי דרך שבורים בדשבורד | `app/dashboard/page.js` | קישורים לדפים שלא קיימים: `/ceo/teams`, `/operator/search` ועוד |
| דשבורדים עם נתוני דמו | `/ceo`, `/inspector`, `/shelter-manager` | חלק מהנתונים מדומים (hardcoded) |
| דוחות פיקוח בקובץ JSON | `/api/inspection` כותב ל-`data/inspectionReports.json` | לא יעבוד ב-Vercel (קבצים לא נשמרים) — להעביר ל-Supabase |

## 🟠 בסיס נתונים

- **מיגרציה מסוכנת:** `supabase/migrations/20260511_remove_oncall_tables.sql` מוחקת טבלאות בשימוש — לא להריץ. מומלץ להעביר לארכיון.
- **מיגרציות כפולות:** `20260510_add_daily_operations.sql` מול `20260510_daily_operations.sql`.
- **טבלאות מוגדרות מחוץ ל-migrations:** קבצי CREATE ב-`scripts/` (ראה 04-database.md) — מומלץ בהמשך להעביר ל-`supabase/migrations/`.
- **שתי מערכות תורנות במקביל** — החלטה מודעת (ראה `docs/archive/DATABASE_CLEANUP_PLAN.md`), אבל כדאי לתעד בממשק מי משתמש במה.

## 🗂️ מבנה הארכיון

בסדר שנעשה באוגוסט 2026:

### `docs/archive/` — מסמכי תכנון היסטוריים
`DATABASE_AUDIT.md`, `DATABASE_CLEANUP_PLAN.md`, `IMPLEMENTATION_PLAN.md`, `TECH_STACK.md` (חלקית לא מעודכן), `SUPABASE_SETUP.md`, `KNOWLEDGE_BASE_SETUP.md`, `PRIORITY_SYSTEM_GUIDE.md`, `SURVEY_SETUP.md`

### `scripts/archive/` — קבצי SQL חד-פעמיים שכבר הורצו
תיקוני משתמשים ספציפיים (oksana, lior), קבצי FIX/URGENT, סקריפטי דיאגנוסטיקה חד-פעמיים.
**אין להריץ אותם שוב** — הם נשמרים לתיעוד בלבד.

### `archive/` (שורש) — קבצים שאינם בשימוש
- `temp-on-call-tab.jsx` — פרגמנט קוד נטוש
- `shelter-verification.html` — כלי אימות קואורדינטות חד-פעמי
- `archive/components/` — `OnCallManager.js`, `OnCallPanel.js` (הוחלפו ב-`OnCallManagerNew`/`WeeklyDutyRoster`), `README_OnCallDynamic.md` (מתעד קומפוננטה שלא קיימת)
- `archive/data/` — `onCall.json`, `shelterStatus.json` (הוחלפו ב-Supabase)

## 🧹 קוד לא בשימוש (הושאר בינתיים, מועמד למחיקה)

קומפוננטות שאף דף לא מייבא:
- `components/WeeklyCalendar.js`, `components/ShiftScheduler.js` — ויזואליזציות שלא חוברו
- `components/GeneralNotifications.js`, `components/ReadOnlyNotifications.js`, `components/EmergencyHotlineBar.js`
- `lib/rtl.js`, `lib/supabase.js`

לפני מחיקה סופית: לוודא עם `grep` שאין ייבוא, ולמחוק בקומיט נפרד שקל לשחזר.

## ✅ המלצות להמשך (לפי סדר עדיפות)

1. החזרת אימות ל-routes המנוטרלים + הוספת אימות ל-routes הפתוחים (לפני/מיד אחרי המעבר לדומיין).
2. החלפת הסיסמאות שנחשפו ב-`.env.example` וניקוי הקובץ.
3. תיקון אי-העקביות הקטנות (redirects, מדיניות סיסמה).
4. העברת דוחות פיקוח מ-JSON ל-Supabase.
5. איחוד הגדרות ה-DB: העברת קבצי CREATE מ-`scripts/` ל-`supabase/migrations/` ועדכון `RUN_MIGRATIONS_ORDER.md` מלא.
6. מחיקת הקוד הלא-בשימוש.
7. השלמת הדשבורדים שעדיין על נתוני דמו (מנכ"ל, פקח, אחראי מקלטים) או הסרתם.
