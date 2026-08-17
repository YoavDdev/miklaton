# ארכיון SQL היסטורי — אין להריץ מכאן דבר

65 קבצי ה-SQL שכאן הם **היסטוריה בלבד**. הם נשמרים כדי שאפשר יהיה להבין
למה הסכימה נראית כפי שהיא, ולא כדי להריץ אותם.

מצב הסכימה הנוכחי נמצא ב-`supabase/baseline/0001_baseline.sql`, שנוצר
ישירות מהפרודקשן.

## למה הועברו לכאן

לשרשרת הזו **אין סדר הרצה תקין שקיים**. זה לא ניחוש — כל קובץ נסרק:

- שלושת קבצי הבסיס (`create_oncall_system`, `create_rbac_system`,
  `create_war_mode`) ממוינים אלפביתית **אחרי** כל הקבצים המתוארכים
  שתלויים בטבלאות שהם יוצרים. על DB נקי הקובץ הראשון נופל מיד.
- `20260511_remove_oncall_tables.sql` מוחקת את `on_call_contacts` ואת
  `on_call_shifts` ב-CASCADE. שלושה קבצים מאוחרים יותר
  (`20260707_add_replacement_contact`, `20260707_add_vacation_to_on_call_contacts`,
  `20260729_vacation_replacement_note`) עושים ALTER לטבלאות שכבר נמחקו.
- שבע טבלאות מוגדרות פעמיים: `departments`, `operator_tasks`,
  `municipalities`, `on_call_contacts`, `daily_updates`, `shift_messages`,
  `operator_shifts`. כולן `CREATE TABLE IF NOT EXISTS`, ולכן ההגדרה השנייה
  נזרקת **בשקט, בלי שגיאה**.
- `operator_tasks` מוגדרת פעמיים עם תחום ערכים סותר: `priority` עם
  `CHECK IN ('דחוף','גבוה','בינוני','נמוך')` מול low/medium/high/urgent.
- כ-14 טבלאות נוצרות רק תחת `scripts/`, ולכן `migrations/` לא היה עצמאי.

## הקבצים המסוכנים

| קובץ | מה הוא עושה |
|---|---|
| `migrations/20260511_remove_oncall_tables.sql` | `DROP TABLE ... CASCADE` על `on_call_contacts` ו-`on_call_shifts`. **שתי הטבלאות חיות בפרודקשן** (24 שורות ב-`on_call_contacts`) — כלומר הקובץ מעולם לא הורץ, והרצתו תמחק נתונים אמיתיים. |
| `migrations/20260817b_drop_temp_password_plain.sql` | מוחק את עמודת הסיסמאות בטקסט גלוי. כבר הורץ (YOA-12). |
| `loose/seed_call_categories.sql` → `seeds/` | `DELETE FROM call_categories` לפני הזרעה — מוחק את כל עץ הקטגוריות של הרשות. |
| `migrations/20260813_rls_anon_lockdown.sql` | מוחק policies מכ-42 טבלאות. מכוון, אבל מוחק גם כל policy שהוגדרה בקבצים אחרים. |

בזמן הארכוב (2026-08-18) טבלת המעקב `supabase_migrations.schema_migrations`
בפרודקשן היתה **ריקה לגמרי** — שום מיגרציה מעולם לא נרשמה בה. כל השינויים
הורצו ידנית ב-SQL Editor. זו הסיבה שהריפו והפרודקשן נפרדו זה מזה.

## מבנה

- `migrations/` — 28 קבצים שהיו ב-`supabase/migrations/`
- `scripts/` — 15 קבצים שהיו ב-`scripts/` (כולל DDL של ~14 טבלאות)
- `scripts-archive/` — 11 קבצים שהיו ב-`scripts/archive/`
- `loose/` — קבצים שהיו ישירות תחת `supabase/`

הזרעים (seeds) הועברו ל-`supabase/seeds/` כשכבה נפרדת ושמישה, לא לכאן.

**שים לב:** `scripts-archive/create-sector-manager-oksana.sql` מכיל סיסמה
בטקסט גלוי, ומספר קבצים מכילים UUID קשיחים של אנשים ספציפיים.

רקע מלא: `docs/11-db-reproducible-design.md`.
