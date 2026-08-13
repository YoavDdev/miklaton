# 03 — API

כל נקודות הקצה תחת `app/api/`. סה"כ ~63 קבצי route ב-~35 קבוצות.

**מקרא עמודת "אימות":**
- 🔒 = דורש JWT (ולפעמים תפקיד ספציפי)
- 🌐 = ציבורי
- 🔒✍️ = קריאה (GET) ציבורית, כתיבה דורשת התחברות + תפקיד

> סטטוס האבטחה עודכן באוגוסט 2026 — פירוט מלא של השינויים ב-[09-security-implementation.md](./09-security-implementation.md)

## אימות ומשתמשים

| Endpoint | Methods | תיאור | אימות |
|----------|---------|-------|--------|
| `/api/auth/login` | POST | התחברות → עוגיית JWT | 🌐 |
| `/api/auth/logout` | POST | מחיקת עוגייה | 🌐 |
| `/api/auth/register` | POST | הרשמה (operator, pending) | 🌐 |
| `/api/auth/me` | GET | פרטי המשתמש המחובר | 🔒 |
| `/api/auth/verify` | GET | בדיקת תקפות טוקן | 🌐 |
| `/api/auth/change-password` | PUT | החלפת סיסמה (מדיניות: 8 תווים + מורכבות) | 🔒 |
| `/api/admin/users` | GET, POST | רשימת/יצירת משתמשים | 🔒 admin |
| `/api/admin/users/[id]` | PUT, DELETE | עדכון/מחיקת משתמש | 🔒 admin |
| `/api/admin/users/[id]/approve` | POST | אישור משתמש ממתין | 🔒 admin |
| `/api/admin/users/[id]/reset-password` | POST | איפוס סיסמה (סיסמה זמנית) | 🔒 admin |
| `/api/profile` | PUT | עדכון שם/טלפון | 🔒 |
| `/api/profile/change-password` | POST | החלפת סיסמה מהפרופיל (מדיניות: 6 תווים) | 🔒 |
| `/api/user-departments` | GET | מחלקות של משתמש | 🌐 |

## מוקד עירוני

| Endpoint | Methods | תיאור | אימות |
|----------|---------|-------|--------|
| `/api/call-categories` | GET, POST, PUT, DELETE | קטגוריות שיחה + אנשי קשר + כללים + תתי-קטגוריות (מסונן לפי זמינות בפועל, כולל שבת דרך Hebcal) | 🔒 (כתיבה: ccm) |
| `/api/call-categories/[id]/contacts` | POST, PUT, DELETE | ניהול אנשי קשר בקטגוריה | 🔒 ccm |
| `/api/call-categories/[id]/contacts/unavailable` | POST, DELETE | סימון "לא זמין" זמני | 🔒 ccm |
| `/api/call-categories/[id]/contacts/vacation` | POST, DELETE | יציאה/חזרה מחופשה | 🔒 ccm |
| `/api/call-categories/[id]/contacts/[contactId]` | PUT, DELETE | עדכון/מחיקת איש קשר ספציפי | 🔒 ccm |
| `/api/call-center-schedule` | GET, POST, DELETE | סידור עבודה שבועי של המוקד | 🔒✍️ ccm |
| `/api/call-center-schedule/current` | GET | המשמרת הנוכחית/הבאה (כולל משמרות לילה חוצות יום) | 🌐 |
| `/api/call-center-schedule/bulk-insert` | POST | ייבוא Excel של סידור | 🔒 ccm |
| `/api/call-center-shifts` | GET | סוגי משמרות מוקד | 🌐 |
| `/api/call-center-staff` | GET, POST, PATCH, DELETE | צוות המוקד | 🔒✍️ ccm |
| `/api/operator/messages` | GET, POST, PUT | הודעות למוקדנים (שליחה: מנהלת מוקד) | 🔒 |
| `/api/operator/sessions` | GET, POST, DELETE | מוקדנים מחוברים (heartbeat כל 10 שניות) | 🔒 |
| `/api/operator/tasks` | GET, POST, PUT, DELETE | משימות מוקדנים | 🔒 |
| `/api/tasks` | GET, POST, PUT, DELETE | משימות כלליות | 🔒 |
| `/api/daily-updates` | GET, POST, PUT, DELETE | עדכונים יומיים | 🔒 |
| `/api/notifications` | GET, POST, DELETE | הודעות כלליות עם חלון זמן | 🔒✍️ operator/ccm |
| `/api/surveys` | GET, POST, PUT, DELETE | ניהול סקרים | 🔒 ccm |
| `/api/surveys/[id]/responses` | GET | תשובות לסקר | 🔒 ccm |
| `/api/surveys/submit` | POST, HEAD | הגשת סקר (תושב) | 🌐 |

## ביטחון

| Endpoint | Methods | תיאור | אימות |
|----------|---------|-------|--------|
| `/api/security-schedule` | GET, POST, PATCH, DELETE | סידור עבודה שבועי ביטחון | 🔒✍️ sm/ccm |
| `/api/security-schedule/bulk-insert` | POST | ייבוא Excel | 🔒 sm/ccm |
| `/api/security-shifts` | GET, POST, PATCH, DELETE | סוגי משמרות | 🔒✍️ sm/ccm |
| `/api/security-staff` | GET, POST, PATCH, DELETE | צוות ביטחון | 🔒✍️ sm/ccm |
| `/api/security-daily-order` | GET, POST, PATCH | פקודת יום (נגזרת אוטומטית מהסידור השבועי) | 🔒✍️ sm/ccm |
| `/api/security-daily-order/entry` | GET, POST, PATCH | שורה בפקודת יום: שינוי שעות, החלפה, הסרה + לוג שינויים | 🌐 ⚠️ (בשימוש /screen — ממתין להחלטה) |
| `/api/security-leave` | GET, POST, PATCH, DELETE | חופשות צוות ביטחון | 🔒✍️ sm/ccm |
| `/api/security-settings` | GET, POST | הגדרות מחלקת ביטחון | 🔒✍️ sm/ccm |

## מקלטים וחירום

| Endpoint | Methods | תיאור | אימות |
|----------|---------|-------|--------|
| `/api/shelter-status` | GET, POST | סטטוס פתוח/סגור של מקלטים ציבוריים | 🔒✍️ operator/ccm |
| `/api/panic-buttons` | GET, POST, PUT, DELETE | לחצני מצוקה (גנים, בתי ספר, מוסדות) | 🔒✍️ operator/ccm |
| `/api/war-mode` | GET, POST | הפעלה/כיבוי מצב חירום גלובלי | 🔒✍️ operator/ccm |
| `/api/events` | GET, POST, PATCH, DELETE | אירועי חירום | 🔒 (כתיבה) |
| `/api/events/[id]` | GET | אירוע + משתתפים + יומן | 🌐 |
| `/api/events/[id]/join` | POST | הצטרפות משתמש מחובר | 🌐 |
| `/api/events/[id]/journal` | POST | רשומת יומן (עדכון/משימה/תמונה/מיקום) | 🌐 |
| `/api/events/[id]/map-data` | GET, PUT | נתוני מפה (מיקומים, חסימות) | 🔒 (PUT) |
| `/api/events/join` | POST | הצטרפות אורח דרך טוקן + טלפון | 🌐 |
| `/api/events/upload` | POST | העלאת תמונה ל-Supabase Storage | 🌐 |
| `/api/inspection` | GET, POST, PATCH | דוחות פיקוח (קובץ JSON מקומי — לא Supabase!) | 🌐 |

## תורנויות ומחלקות

| Endpoint | Methods | תיאור | אימות |
|----------|---------|-------|--------|
| `/api/duty-roster` | GET, POST, PATCH, DELETE | לוח תורנויות (כולל `?current=true` למי תורן עכשיו) | 🔒✍️ ccm/sm (DELETE ציבורי — /duty-form) |
| `/api/duty-form` | GET, POST | טופס תורנות למנהל מחלקה | 🌐 |
| `/api/on-call-contacts` | GET, POST | אנשי קשר כוננים (מערכת חדשה) | 🔒✍️ ccm |
| `/api/on-call-contacts/[id]` | PATCH | עדכון (למשל חזרה מחופשה) | 🔒 ccm |
| `/api/on-call/current-legacy` | GET | תורן נוכחי (מערכת ותיקה) | 🌐 |
| `/api/departments` | GET, POST, PATCH, DELETE | מחלקות | 🔒✍️ ccm/sm |
| `/api/contacts` | GET, POST, PATCH, DELETE | אנשי קשר כלליים | 🔒✍️ ccm/sm |
| `/api/municipalities` | GET | עיריות פעילות | 🌐 |
| `/api/municipalities/yehud` | GET | עיריית יהוד | 🌐 |
| `/api/vacations` | GET | כל החופשות הפעילות | 🌐 |

## ידע, מידע ושירותים חיצוניים

| Endpoint | Methods | תיאור | שירות חיצוני |
|----------|---------|-------|---------------|
| `/api/knowledge-base` | GET, POST, PUT, DELETE | ערכי מאגר ידע (כתיבה: 🔒 ccm) | — |
| `/api/knowledge-chat` | POST | צ'אט AI עם הקשר חי — 🔒 מחייב התחברות | **OpenAI gpt-4o-mini**, Hebcal |
| `/api/garbage-collection` | GET, POST, PUT, DELETE | לוח פינוי גזם/אשפה לפי רחוב (כתיבה: 🔒 ccm) | — |
| `/api/geocode` | GET | כתובת → קואורדינטות (מוגבל ליהוד-מונוסון) | **Google Geocoding** |
| `/api/weather` | GET | מזג אוויר + התראות | **Open-Meteo** |
| `/api/shabbat-times` | GET | זמני כניסת/יציאת שבת (עם cache יומי) | **Hebcal** |
| `/api/version` | GET | גרסת האפליקציה (`public/version.json`) | — |
