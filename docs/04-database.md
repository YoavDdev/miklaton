# 04 — בסיס נתונים (Supabase / PostgreSQL)

~45 טבלאות. ההגדרות מפוזרות בין `supabase/schema.sql`, `supabase/migrations/` וקבצי SQL ב-`scripts/`.

## טבלאות לפי תחום

### משתמשים והרשאות
| טבלה | תיאור | מוגדרת ב- |
|-------|-------|-----------|
| `user_profiles` | פרופיל מורחב (שם, טלפון, role, status, מחלקה, must_change_password) | `migrations/create_rbac_system.sql` |
| `user_departments` | שיוך משתמש למספר מחלקות | `migrations/20260327_add_user_departments_table.sql` |
| `password_resets` | איפוסי סיסמה ע"י אדמין | `create_rbac_system.sql` |
| `audit_log` | לוג פעולות מערכת | `create_rbac_system.sql` |
| `system_settings` | הגדרות גלובליות (JSONB) | `create_rbac_system.sql` |

### מחלקות, אנשי קשר ותורנויות
| טבלה | תיאור | הערות |
|-------|-------|--------|
| `departments` | מחלקות העירייה | |
| `contacts` | אנשי קשר (מערכת ותיקה) | בשימוש פעיל ע"י מנהלי מכלול וטפסי תורנות |
| `duty_roster` | תורנויות שבועיות (מערכת ותיקה) | בשימוש פעיל — `WeeklyDutyRoster`, `/on-call-query` |
| `on_call_contacts` | כוננים (מערכת חדשה, רב-עירונית) | כולל חופשות, החלפות, אסקלציה |
| `on_call_shifts` | משמרות כוננות דינמיות | |

> ⚠️ **שתי מערכות תורנות חיות במקביל** (ותיקה + חדשה). לפי `DATABASE_CLEANUP_PLAN.md` (בארכיון) הוחלט בכוונה לשמור את שתיהן: הוותיקה לתורנויות שבועיות קבועות, החדשה לכוננים/חברות חיצוניות/חופשות.

### קטגוריות שיחה (מדריך שיחות)
| טבלה | תיאור |
|-------|-------|
| `call_categories` | קטגוריות (חירום, מים, רווחה...) עם הנחיות למוקדן |
| `call_category_contacts` | אנשי קשר לקטגוריה: סדר אסקלציה, עדיפות, ימי/שעות זמינות, חופשה, החלפה |
| `call_category_rules` | כללים/שאלות/מקרים מיוחדים לקטגוריה |
| `call_category_subcategories` + `call_category_subcategory_contacts` | תתי-קטגוריות ואנשי הקשר שלהן |

### תפעול יומי ומוקד
| טבלה | תיאור |
|-------|-------|
| `municipalities` | עיריות (רב-עירוניות) |
| `daily_updates` | עדכונים יומיים (חסימות, אירועים, תשתיות) |
| `operator_tasks` | משימות מוקדנים |
| `operator_sessions` | מוקדנים מחוברים (heartbeat) |
| `operator_messages` | הודעות למוקדנים |
| `shift_messages` | הודעות העברת משמרת |
| `operator_shifts` | משמרות מוקדנים (מערכת ישנה) |
| `call_center_staff` / `call_center_shifts` / `call_center_schedule` | צוות, סוגי משמרות וסידור עבודה שבועי של המוקד |
| `general_notifications` | הודעות כלליות עם חלון זמן |

### ביטחון
| טבלה | תיאור |
|-------|-------|
| `security_staff` | צוות (פיקוח/שיטור) |
| `security_shifts` | סוגי משמרות |
| `security_weekly_schedule` | סידור שבועי |
| `security_daily_orders` + `security_daily_order_entries` | פקודת יום ושורותיה (כולל שינויים, החלפות, משימות JSONB) |
| `security_shift_changes` | לוג שינויי משמרות |
| `security_staff_leave` | חופשות |
| `security_settings` | הגדרות מחלקה (JSONB) |

### חירום ומקלטים
| טבלה | תיאור |
|-------|-------|
| `shelter_status` | סטטוס פתוח/סגור למקלטים ציבוריים |
| `war_mode` | מתג מצב חירום גלובלי |
| `emergency_events` | אירועי חירום (סוג, חומרה, טוקן הזמנה, נתוני מפה JSONB) |
| `event_participants` | משתתפים (משתמשים/אנשי קשר/אורחים) + סטטוס שטח |
| `event_journal` | יומן אירוע (עדכון/משימה/תמונה/מיקום, נעיצה) |
| `panic_buttons` | לחצני מצוקה (כתובת, הוראות למוקדן, אנשי קשר JSONB) |

### ידע, סקרים ועוד
| טבלה | תיאור |
|-------|-------|
| `knowledge_base` | ערכי מאגר ידע (כותרת, תוכן, קטגוריה, תגיות, אנשי קשר) |
| `knowledge_chat_history` | היסטוריית צ'אט AI |
| `surveys` + `survey_responses` | סקרים ותשובות (4 שאלות דירוג + טקסט חופשי) |
| `garbage_collection_schedule` | פינוי גזם/אשפה לפי רחוב ויום |

> הערה: נתוני המקלטים עצמם (שמות, כתובות, קואורדינטות) הם **סטטיים** ב-`data/shelters.json` — לא בבסיס הנתונים. רק הסטטוס (פתוח/סגור) ב-DB.

## Supabase Storage
- Bucket בשם `event-images` — תמונות שמועלות ליומני אירועים.

## היכן מוגדרת כל טבלה?

### `supabase/migrations/` — מיגרציות רשמיות
סדר כרונולוגי (השמות מכילים תאריכים):
1. `create_rbac_system.sql` — משתמשים והרשאות
2. `create_oncall_system.sql` — departments, contacts, duty_roster
3. `create_war_mode.sql`
4. `20260326_*` — must_change_password, week_start_date, 7 תפקידים
5. `20260327_add_user_departments_table.sql`
6. `20260510_daily_operations.sql` — municipalities, on_call_contacts, daily_updates ועוד
7. `20260511_*` — call categories + שיפורים + עדיפויות
8. `20260707_*` — חופשות והחלפות
9. `20260714_panic_buttons.sql`
10. `20260722_*` — garbage, knowledge base, security shift changes
11. `20260729_*` — החלפות בפקודת יום, הערות החלפה

### `scripts/` — טבלאות שהוגדרו מחוץ למיגרציות
אלה קבצי הקמה אמיתיים (לא hotfix) שכדאי בעתיד להעביר ל-`supabase/migrations/`:
- `CREATE-emergency-events.sql` — אירועי חירום (3 טבלאות)
- `CREATE-call-center-manager-system.sql` — operator_tasks/sessions/messages
- `CREATE-surveys-tables.sql` — סקרים
- `create-security-*.sql` — כל טבלאות הביטחון (4 קבצים)
- `create-call-center-schedule-tables.sql` — סידור מוקד
- `ADD-*.sql`, `UPGRADE-journal-v2.sql` — הוספות עמודות לאירועים/יומן
- `add-notification-expires-at.sql`, `add-shabbat-observer-to-contacts.sql`, `add-staff-name-to-weekly-schedule.sql`

### ⚠️ נקודות שדורשות תשומת לב
- `migrations/20260511_remove_oncall_tables.sql` **מוחקת** את on_call_contacts/on_call_shifts, אבל מיגרציות מאוחרות יותר מוסיפות להן עמודות — כנראה בוטלה בפועל. לא להריץ מחדש!
- `20260510_add_daily_operations.sql` ו-`20260510_daily_operations.sql` חופפות חלקית.
- `supabase/RUN_MIGRATIONS_ORDER.md` מכסה רק את קטגוריות השיחה — לא את כל המיגרציות.

## הקמת סביבה חדשה (סדר הרצה מומלץ)
1. `supabase/schema.sql` (shelter_status, general_notifications)
2. כל `supabase/migrations/` לפי סדר כרונולוגי (לדלג על `20260511_remove_oncall_tables.sql`)
3. קבצי ההקמה מ-`scripts/` (רשימה למעלה)
4. קבצי seed: `supabase/seed_yehud_simple.sql`, `seed_call_categories.sql`, `seed_oncall_contacts.sql`, `seed_panic_buttons.sql`, `seed_kindergartens.sql`, `seed_schools.sql`
