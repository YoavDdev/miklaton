# דוח יומי שלב 3 — אירועי העירייה אוטומטית ורשימת עבודות מנוהלת

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** מקטע "אירועים בעיר" נמשך אוטומטית מאתר העירייה לפי יום הדוח, ומקטע "עבודות בעיר" הופך לרשימה מנוהלת שנשמרת במערכת — טווחי התאריכים עושים את הסינון, עם דגל "הסתיימה — להסיר?" והוספה ששומרת קדימה.

**Architecture:** לוגיקה טהורה חדשה ב-`lib/daily-report-city.js` (מיפוי אירועי WordPress לחלון הדוח, סינון פרויקטים לפי טווח); שני ראוטים דקים (`/api/daily-report/city-events` פרוקסי לאתר העירייה, `/api/daily-report/projects` CRUD על טבלת `report_projects`); הדף מחליף את גרירת האירועים/עבודות מהצילום הקודם במקורות החדשים. הכול לפי docs/16 שכבר מאשר את שני המנגנונים.

**Tech Stack:** Next.js route handlers, Supabase (service role, אפס policies), vitest. תבנית ההרשאות והבדיקות של `/api/daily-report` הקיים.

**Spec:** `docs/16-daily-report-design.md` — "אירועים בעיר — מקור אוטומטי" ו"עבודות בעיר — התאריכים עושים את הסינון".

## Global Constraints

- הרשאות: `shift_supervisor`, `call_center_manager` בלבד (כמו `/api/daily-report`).
- כל טבלה חדשה נולדת עם `municipality_id not null` (נאכף ב-tenant-columns).
- אתר העירייה לא זמין ⇒ הדוח יוצא בכל מקרה (המקטע נשאר כמו היום — נגרר מהדוח הקודם).
- עבודת "אין צפי" יורדת רק בלחיצת "הסתיימה" מפורשת; תאריך שעבר ⇒ דגל, לא מחיקה שקטה.

---

### Task 1: לוגיקה טהורה — `lib/daily-report-city.js`

**Files:** Create `lib/daily-report-city.js`, Test `tests/daily-report-city.test.js`

**Interfaces (Produces):**
- `mapCityEvents(wpEvents, reportDate) → [{name, date, hour}]` — מסנן ל-`reportWindow` (ראשון ⇒ שישי-ראשון), ממיר `acf.event_date` (YYYYMMDD) ל-DD.MM.YYYY, `event_hours` ל-HH:MM, מפענח HTML entities בכותרת, מנקה מיקום (טאבים, סיומת "יהוד-מונוסון") ומחבר `כותרת - מיקום`. ממוין תאריך+שעה.
- `projectRowsForReport(projects, reportDate) → [{id, description, start, end, owner, overdue}]` — רק `status==='active'`; `start` מ-`start_date` (DD.MM.YYYY או ''); `end` = `end_date` מפורמט / `end_date_approx` / 'אין צפי לסיום'; `overdue=true` כשanged `end_date` < יום הדוח (הדגל).
- `parseIlDate(str) → 'YYYY-MM-DD' | null` — קלט DD.MM.YYYY או DD.MM.YY, לשמירת קלט המשתמש כ-date.

- [ ] בדיקות נכשלות: סינון לפי יום + סופ"ש, פורמטים, entities (`&#039;`), overdue, אין-צפי, parseIlDate
- [ ] מימוש; `npx vitest run tests/daily-report-city.test.js` ירוק; קומיט

### Task 2: מיגרציה — `report_projects`

**Files:** Create `supabase/migrations/20260826150000_add_report_projects.sql`

```sql
-- YOA-42 שלב 3 (docs/16): עבודות בעיר - רשימה מנוהלת עם טווחי תאריכים.
create table public.report_projects (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null,
  description text not null,
  owner text,
  start_date date,
  end_date date,
  end_date_approx text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.report_projects enable row level security;
-- אפס policies בכוונה: גישה דרך service role בלבד, כמו daily_reports.
```

- [ ] `npx vitest run tests/migrations.test.js tests/tenant-columns.test.js` ירוק; קומיט

### Task 3: ראוט `/api/daily-report/projects`

**Files:** Create `app/api/daily-report/projects/route.js`, Test `tests/daily-report-projects-api.test.js` (באותה תבנית mock של `daily-report-api.test.js`)

- GET ⇒ הפעילות (`status='active'`) ממוינות `created_at`; POST `{description, owner, start, end}` ⇒ insert עם `municipality_id` מהפרופיל, `end` מפוענח: DD.MM.YYYY ⇒ `end_date`, אחרת `end_date_approx` (ריק ⇒ שניהם null); PATCH `{id, ...}` ⇒ עדכון (כולל `status:'ended'`), `updated_at=now()`.
- [ ] בדיקות: 403 למוקדן, insert נושא municipality_id, PATCH בלי id ⇒ 400; מימוש; ירוק; קומיט

### Task 4: ראוט `/api/daily-report/city-events`

**Files:** Create `app/api/daily-report/city-events/route.js`, Test `tests/daily-report-city-events-api.test.js`

- GET `?date=YYYY-MM-DD` ⇒ fetch עמודים מ-`https://yehud-monosson.muni.il/wp-json/wp/v2/events?per_page=100&page=N` (עד 3, AbortController 10ש'), `mapCityEvents`, `{success:true, data}`. כשל רשת ⇒ `{success:true, data: [], warning}` — לא 500.
- [ ] בדיקות: 403 למוקדן; mock ל-`global.fetch` ⇒ מיפוי נכון; כשל fetch ⇒ 200 עם data ריק; מימוש; ירוק; קומיט

### Task 5: חיווט הדף

**Files:** Modify `app/daily-report/page.js`

- העלאת קובץ יום: קריאה ל-city-events; הצלחה עם נתונים ⇒ הם המקטע (עם כיתוב "נמשך מאתר העירייה"); ריק/כשל ⇒ ההתנהגות הקיימת (נגרר מהדוח הקודם) + הערה.
- עבודות: נטענות מ-projects API דרך `projectRowsForReport`; שורה עם `overdue` מודגשת בכתום עם "הסתיימה אתמול לפי התכנון" + כפתורים [✔ הסתיימה] (PATCH status=ended) [📅 הארך] (קלט תאריך ⇒ PATCH end); עריכת שדות עם 💾 לשורה (PATCH); "➕ עבודה" ⇒ טופס שנשמר ב-POST; ה-snapshot ממשיך לשאת `{description,start,end,owner}` בלבד.
- מצלמות: בלי שינוי לוגי — כבר ידני עם ברירת מחדל מהדוח הקודם; מקבל כותרת מקטע משלו שתבליט אותו.
- [ ] `npx vitest run` מלא + lint + build ירוקים; קומיט

### Task 6: אפיון

- [ ] docs/16: סימון שלב 3 כממומש (26.08); קומיט; מיזוג ל-main

## Self-Review

מכסה את שלוש הבקשות של יואב (מצלמות בולט־ידני, אירועים אוטומטי, פרויקטים נשמרים); אין placeholders; החתימות עקביות (projectRowsForReport נצרך ב-Task 5 כהגדרתו ב-Task 1).
