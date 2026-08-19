# דוח סיכום יומי — שלב 1 (שלד): תוכנית מימוש

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** האחמ"ש מעלה CSV מבינה 360, מסמן ידנית אירועים חריגים ב־Preview, ממלא את המספרים, ומפיק Excel בפורמט הקיים — עם היסטוריה, אזהרת דריסה, ותגי "חדש מאז". בלי AI (שלב 2), בלי משיכת אירועים אוטומטית (שלב 3), בלי PDF (שלב 4).

**Architecture:** פרסר CSV טהור ב־`lib/` (נבדק מול fixture סינתטי בפורמט האמיתי) → ראוט העלאה/שמירה מאומת → דף `/daily-report` עם Preview → בונה Excel בצד הלקוח מ־snapshot → טבלת `daily_reports` שומרת כל הפקה כ־JSONB.

**Tech Stack:** Next.js 14 App Router (JS), Supabase (service role בשרת), ספריית `xlsx` (כבר בפרויקט), vitest.

**Spec:** `docs/16-daily-report-design.md` — קרא אותו לפני שאתה מתחיל. הסכימות והפורמטים כאן נגזרים ממנו ומהקבצים האמיתיים.

## Global Constraints

- **עברית בהערות ובממשק; RTL בכל UI חדש** (`dir="rtl"`).
- **כל ראוט API חדש חייב אימות** — `tests/api-auth-contract.test.js` ייכשל אוטומטית אם לא. תפקידים מורשים: `shift_supervisor`, `call_center_manager` (admin עובר תמיד).
- **כל דף חדש חייב להיכנס ל־matcher של ה־middleware** — `tests/page-gates.test.js` אוכף.
- **טבלה חדשה חייבת `municipality_id`** — `tests/tenant-columns.test.js` אוכף מול ה־baseline.
- **מיגרציות: ‏`supabase migration new` → `npm run db:lint-migrations` → `supabase db push` → `supabase db dump --linked -f supabase/baseline/0001_baseline.sql` → `npm run db:check-drift`** (דורש colima: `colima start`).
- **אסור להכניס לריפו קבצים גולמיים מבינה** (PII של תושבים). ה־fixture בתוכנית זו סינתטי.
- **אסור `console.log`** — כלל lint ברמת error. `console.error` מותר.
- **supabase-js מחזיר `{ error }` ולא זורק** — כל קריאה קולטת error; בדיקת `supabase-error-handling` אוכפת שאין `await supabase` בתחילת שורה.
- אחרי כל commit ירוק: `git push` (Vercel מפרסם מ־main).

---

### Task 1: fixture סינתטי של ייצוא בינה

**Files:**
- Create: `tests/fixtures/binaa-tickets-sample.csv`

**Interfaces:**
- Produces: קובץ CSV בפורמט המדויק של בינה — UTF-8 עם BOM, שדות במרכאות, כותרת בת 26 עמודות — שכל בדיקות הפרסר רצות מולו.

- [ ] **Step 1: צור את הקובץ** עם התוכן הבא **בדיוק** (שורה ראשונה = הכותרת האמיתית מבינה; 10 פניות סינתטיות שמכסות: פנייה רגילה, פנייה־בת "-ב", שתי פניות על אותו אירוע, פנייה עם שורת־שורה בתוך שדה, סטטוסים שונים, יום שישי+שבת+ראשון לכלל הסופ"ש):

```csv
"מועדפים","מס' פניה","תאריך ושעת פתיחה","סטטוס פנייה","שם הפונה","טלפון נייד","כתובת ואתר/מוסד","מחלקה","נושא","נושא משנה","תיאור","תמונות ומסמכים?","גורם מטפל","מקור פניה","תאריך פתיחה","תאריך סגירה","תאריך יעד לסגירה","שורת טיפול אחרונה","מדד SLA לפני חריגה","תאריך סיום סטטוס רדום","מנהל","דירוג המפגע","כביש מדרכה","הערות","תמונה","מספר רישוי"
"    ","  600010","16/08/26 21:12","הטיפול הסתיים","ישראל ישראלי","050-0000001","הדקל 4","גינון","עצים","עץ או ענפים שנפלו","עץ גדול קרס על הכביש וחוסם נתיב","1","גנן תורן","וואטסאפ","16/08/26","16/08/26 22:40","17/08/26 09:00","העץ פונה והכביש נפתח","5.00%"," -","עיריית יהוד","","","","",""
"    ","  600009","16/08/26 20:03","בטיפול","דנה כהן","050-0000002","הדקל 4","גינון","עצים","עץ או ענפים שנפלו","עץ נפל ליד הבית שלנו מסוכן מאוד","0","גנן תורן","מוקד עירוני","16/08/26"," -","17/08/26 09:00","הועבר לגנן התורן","12.00%"," -","עיריית יהוד","","","","",""
"    ","  600008","16/08/26 15:30","הטיפול הסתיים","יוסי לוי","050-0000003","הרצל 10","שיטור עירוני","גרימת רעש","","מסיבה רועשת בחצר","0","סייר תורן","מוקד עירוני","16/08/26","16/08/26 16:00"," -","המוזיקה הופסקה","3.00%"," -","עיריית יהוד","","","","",""
"    ","  600007-ב","16/08/26 12:00","תהליך הסתיים","רות אלון","050-0000004","העצמאות 2","תברואה","פינוי גזם","","הפנייה פוצלה לתברואה לפינוי הגזם","0","מנוף תורן","מוקד עירוני","16/08/26","17/08/26 08:00","18/08/26 08:00","טופל","20.00%"," -","עיריית יהוד","","","","",""
"    ","  600007","16/08/26 12:00","הטיפול הסתיים","רות אלון","050-0000004","העצמאות 2","פיקוח עירוני","השלכת פסולת מבניה","","ערימת פסולת בניין על המדרכה
כולל קרשים עם מסמרים בולטים","2","פקח תורן","וואטסאפ","16/08/26","16/08/26 13:10","17/08/26 12:00","ניתנה התראה לקבלן","8.00%"," -","עיריית יהוד","","","","",""
"    ","  600006","16/08/26 09:15","פניה נפתחה במערכת המוקד","אבי מזרחי","050-0000005","כללי ","גבייה","בירור חוב","","מבקש בירור על חוב ארנונה","0","","מוקד עירוני","16/08/26"," -","20/08/26 09:00",""," -"," -","עיריית יהוד","","","","",""
"    ","  600005","16/08/26 07:50","הטיפול הסתיים","מירב גל","050-0000006","גן הפקאן","פיקוח עירוני","סיוע לגורם עירייה","","אדם מבוגר נפל בגן ונחבל בראשו מדמם","0","פקח תורן, מד\"א","מוקד עירוני","16/08/26","16/08/26 08:30","16/08/26 09:00","פקח ביצע חבישה עד הגעת מד\"א","1.00%"," -","עיריית יהוד","","","","",""
"    ","  600004","15/08/26 22:10","הטיפול הסתיים","גיל עמר","050-0000007","השקד 8","שיטור עירוני","הפרעה לתנועה","","רכב חוסם כניסה לחניה","0","סייר תורן","וואטסאפ","15/08/26","15/08/26 22:40"," -","הרכב הוזז","2.00%"," -","עיריית יהוד","","","","",""
"    ","  600003","15/08/26 10:00","הטיפול הסתיים","נעה בר","050-0000008","הזית 12","ניקיון","רחוב מלוכלך","","זכוכיות שבורות על המדרכה","1","פועל תורן","וואטסאפ","15/08/26","15/08/26 11:00","16/08/26 10:00","נוקה","4.00%"," -","עיריית יהוד","","","","",""
"    ","  600002","14/08/26 23:55","הטיפול הסתיים","דוד שם","050-0000009","התמר 1","תברואה","פינוי פח אשפה","","פח מלא שלא פונה","0","נהג תורן","מוקד עירוני","14/08/26","16/08/26 06:30","17/08/26 06:00","פונה","6.00%"," -","עיריית יהוד","","","","",""
```

- [ ] **Step 2: ודא BOM** — הקובץ חייב להתחיל ב־BOM כמו הייצוא האמיתי:

Run: `python3 -c "open('tests/fixtures/binaa-tickets-sample.csv','r+b').write(b'\xef\xbb\xbf'+open('tests/fixtures/binaa-tickets-sample.csv','rb').read()) if open('tests/fixtures/binaa-tickets-sample.csv','rb').read(3)!=b'\xef\xbb\xbf' else None" && head -c 3 tests/fixtures/binaa-tickets-sample.csv | xxd`
Expected: `efbb bf`

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/binaa-tickets-sample.csv
git commit -m "test: synthetic Bina tickets fixture in the real export format (YOA-42)"
```

---

### Task 2: פרסר הפניות — `lib/binaa-tickets.js`

**Files:**
- Create: `lib/binaa-tickets.js`
- Test: `tests/binaa-tickets.test.js`

**Interfaces:**
- Produces:
  - `parseTicketsCsv(text: string) -> Ticket[]` — ‏Ticket = `{ id, parentId|null, openedAt: Date, status, department, subject, subSubject, description, address, handler, lastTreatment, reporterName, reporterPhone }`. ‏`parentId` מזוהה מסיומת "-X" במס' הפנייה.
  - `reportWindow(reportDate: Date) -> { start: Date, end: Date }` — יום רגיל: אותו יום 00:00–23:59; יום ראשון: משישי 00:00 עד ראשון 23:59.
  - `prepareTickets(tickets, reportDate) -> { tickets: Ticket[], mergedCount: number }` — מסנן לחלון, מאחד פניות־בנות לתוך האם (`linkedDepartments: string[]` על האם), ומקבץ כפילויות (אותה כתובת + אותו נושא באותו יום ⇒ `groupCount` על הראשונה, השאר מסומנות `groupedInto: <id>`).
  - `stripPii(ticket) -> object` — עותק בלי `reporterName`/`reporterPhone` (ישמש את שלב 2; נבנה עכשיו כי הוא זול והבדיקה מעגנת את החוזה).

- [ ] **Step 1: כתוב את הבדיקות** ב־`tests/binaa-tickets.test.js`:

```javascript
import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { parseTicketsCsv, reportWindow, prepareTickets, stripPii } from '@/lib/binaa-tickets';

const FIXTURE = fs.readFileSync(
  path.join(process.cwd(), 'tests', 'fixtures', 'binaa-tickets-sample.csv'),
  'utf8'
);

describe('parseTicketsCsv', () => {
  const tickets = parseTicketsCsv(FIXTURE);

  it('קורא את כל השורות, כולל BOM ושדה עם שורת-שורה בתוכו', () => {
    expect(tickets.length).toBe(10);
    const multi = tickets.find(t => t.id === '600007');
    expect(multi.description).toContain('קרשים עם מסמרים');
  });

  it('מפענח תאריך ושעה ישראליים (DD/MM/YY HH:MM)', () => {
    const t = tickets.find(t => t.id === '600010');
    expect(t.openedAt.getFullYear()).toBe(2026);
    expect(t.openedAt.getMonth()).toBe(7);
    expect(t.openedAt.getDate()).toBe(16);
    expect(t.openedAt.getHours()).toBe(21);
  });

  it('מזהה פנייה-בת לפי סיומת', () => {
    const child = tickets.find(t => t.id === '600007-ב');
    expect(child.parentId).toBe('600007');
    const parent = tickets.find(t => t.id === '600007');
    expect(parent.parentId).toBeNull();
  });
});

describe('reportWindow', () => {
  it('יום חול: אותו יום בלבד', () => {
    const w = reportWindow(new Date(2026, 7, 18)); // שלישי
    expect(w.start.getDate()).toBe(18);
    expect(w.end.getDate()).toBe(18);
  });

  it('יום ראשון: משישי עד ראשון (כלל הסופ"ש)', () => {
    const w = reportWindow(new Date(2026, 7, 16)); // ראשון
    expect(w.start.getDate()).toBe(14);
    expect(w.end.getDate()).toBe(16);
  });
});

describe('prepareTickets', () => {
  const all = parseTicketsCsv(FIXTURE);

  it('דוח יום ראשון כולל את פניות שישי ושבת', () => {
    const { tickets } = prepareTickets(all, new Date(2026, 7, 16));
    const ids = tickets.map(t => t.id);
    expect(ids).toContain('600002'); // שישי
    expect(ids).toContain('600004'); // שבת
  });

  it('פנייה-בת מתאחדת לתוך האם ולא מופיעה בנפרד', () => {
    const { tickets } = prepareTickets(all, new Date(2026, 7, 16));
    expect(tickets.find(t => t.id === '600007-ב')).toBeUndefined();
    const parent = tickets.find(t => t.id === '600007');
    expect(parent.linkedDepartments).toContain('תברואה');
  });

  it('שתי פניות על אותו אירוע (כתובת+נושא+יום) מקובצות לאחת', () => {
    const { tickets } = prepareTickets(all, new Date(2026, 7, 16));
    const tree = tickets.filter(t => t.address.includes('הדקל') && !t.groupedInto);
    expect(tree.length).toBe(1);
    expect(tree[0].groupCount).toBe(2);
  });
});

describe('stripPii', () => {
  it('מסיר שם וטלפון, משאיר את התוכן', () => {
    const t = parseTicketsCsv(FIXTURE)[0];
    const clean = stripPii(t);
    expect(clean.reporterName).toBeUndefined();
    expect(clean.reporterPhone).toBeUndefined();
    expect(clean.description).toBe(t.description);
  });
});
```

- [ ] **Step 2: הרץ וודא כשל**

Run: `npx vitest run tests/binaa-tickets.test.js`
Expected: FAIL — המודול לא קיים.

- [ ] **Step 3: כתוב את `lib/binaa-tickets.js`.** פרסר CSV ידני (אין ספריית CSV בפרויקט; אל תוסיף תלות) — מכונת מצבים פשוטה שמכבדת מרכאות כפולות ו־`""` כמרכאה בתוך שדה:

```javascript
/**
 * פענוח ייצוא הפניות מבינה 360 (YOA-42, docs/16).
 * הקובץ: CSV עם BOM, כל שדה במרכאות, שורת-שורה אפשרית בתוך שדה.
 */

const HEADER_MAP = {
  "מס' פניה": 'id',
  'תאריך ושעת פתיחה': 'openedAtRaw',
  'סטטוס פנייה': 'status',
  'שם הפונה': 'reporterName',
  'טלפון נייד': 'reporterPhone',
  'כתובת ואתר/מוסד': 'address',
  'מחלקה': 'department',
  'נושא': 'subject',
  'נושא משנה': 'subSubject',
  'תיאור': 'description',
  'גורם מטפל': 'handler',
  'שורת טיפול אחרונה': 'lastTreatment',
};

function splitCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(f => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some(f => f.trim() !== '')) rows.push(row); }
  return rows;
}

function parseIsraeliDateTime(raw) {
  const m = raw?.trim().match(/^(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;
  return new Date(2000 + Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]));
}

export function parseTicketsCsv(text) {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = splitCsv(clean);
  if (rows.length < 2) return [];
  const header = rows[0].map(h => h.trim());
  const idx = {};
  for (const [hebrew, key] of Object.entries(HEADER_MAP)) {
    idx[key] = header.indexOf(hebrew);
  }
  return rows.slice(1).map(cells => {
    const get = (key) => (idx[key] >= 0 ? (cells[idx[key]] || '').trim() : '');
    const rawId = get('id');
    // סיומת "-X" = פנייה-בת שפוצלה למחלקה נוספת; האם היא החלק שלפני המקף
    const childMatch = rawId.match(/^(\d+)-(.+)$/);
    return {
      id: rawId,
      parentId: childMatch ? childMatch[1] : null,
      openedAt: parseIsraeliDateTime(get('openedAtRaw')),
      status: get('status'),
      department: get('department'),
      subject: get('subject'),
      subSubject: get('subSubject'),
      description: get('description'),
      address: get('address'),
      handler: get('handler'),
      lastTreatment: get('lastTreatment'),
      reporterName: get('reporterName'),
      reporterPhone: get('reporterPhone'),
    };
  }).filter(t => t.id && t.openedAt);
}

// יום רגיל: היום עצמו. יום ראשון: שישי-ראשון - בסופ"ש לא מופק דוח (docs/16)
export function reportWindow(reportDate) {
  const start = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate());
  if (reportDate.getDay() === 0) start.setDate(start.getDate() - 2);
  const end = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate(), 23, 59, 59);
  return { start, end };
}

export function prepareTickets(tickets, reportDate) {
  const { start, end } = reportWindow(reportDate);
  const inWindow = tickets.filter(t => t.openedAt >= start && t.openedAt <= end);

  // איחוד פניות-בנות: המחלקה של הבת נרשמת על האם, הבת יוצאת מהרשימה
  const byId = new Map(inWindow.map(t => [t.id, t]));
  const merged = [];
  let mergedCount = 0;
  for (const t of inWindow) {
    if (t.parentId && byId.has(t.parentId)) {
      const parent = byId.get(t.parentId);
      parent.linkedDepartments = [...(parent.linkedDepartments || []), t.department];
      mergedCount++;
      continue;
    }
    merged.push(t);
  }

  // קיבוץ כפילויות: אותה כתובת + אותו נושא באותו יום = אירוע אחד
  const seen = new Map();
  for (const t of merged) {
    const key = `${t.address}|${t.subject}|${t.openedAt.toDateString()}`;
    if (seen.has(key)) {
      const first = seen.get(key);
      first.groupCount = (first.groupCount || 1) + 1;
      t.groupedInto = first.id;
    } else seen.set(key, t);
  }

  return { tickets: merged, mergedCount };
}

// לפני כל שליחה ל-AI (שלב 2): זהות הפונה לא עוזבת את המערכת (docs/16)
export function stripPii(ticket) {
  const { reporterName, reporterPhone, ...clean } = ticket;
  return clean;
}
```

- [ ] **Step 4: הרץ וודא ירוק**

Run: `npx vitest run tests/binaa-tickets.test.js`
Expected: PASS (כל הבדיקות).

- [ ] **Step 5: הרץ את כל החבילה ו־commit**

Run: `npx vitest run` — הכל ירוק.

```bash
git add lib/binaa-tickets.js tests/binaa-tickets.test.js
git commit -m "feat: Bina 360 tickets parser — window, child-merge, grouping, PII strip (YOA-42)"
```

---

### Task 3: מיגרציה — טבלת `daily_reports`

**Files:**
- Create: `supabase/migrations/<timestamp>_add_daily_reports.sql` (דרך ‏`supabase migration new add_daily_reports`)
- Modify: `supabase/baseline/0001_baseline.sql` (רענון אחרי push)

**Interfaces:**
- Produces: טבלת `daily_reports` — ‏`id uuid pk`, ‏`municipality_id uuid not null`, ‏`report_date date not null`, ‏`produced_at timestamptz default now()`, ‏`produced_by uuid`, ‏`produced_by_name text`, ‏`source_file_name text`, ‏`snapshot jsonb not null`. RLS מופעל, אפס policies (גישה דרך service role בלבד — המדיניות של המערכת).

- [ ] **Step 1: צור את המיגרציה**

Run: `supabase migration new add_daily_reports`

תוכן הקובץ:

```sql
-- YOA-42 (docs/16): דוח הסיכום היומי. כל הפקה נשמרת כצילום JSONB מלא -
-- ממנו מפיקים שוב את הקבצים ומחשבים "חדש מאז" בהפקת הערב.
create table public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null,
  report_date date not null,
  produced_at timestamptz not null default now(),
  produced_by uuid,
  produced_by_name text,
  source_file_name text,
  snapshot jsonb not null
);

alter table public.daily_reports enable row level security;
-- אפס policies בכוונה: קריאה וכתיבה דרך service role בלבד, כמו שאר המערכת.
```

- [ ] **Step 2: לינט, דחיפה, רענון baseline**

Run:
```bash
npm run db:lint-migrations
supabase db push
colima status || colima start
supabase db dump --linked -f supabase/baseline/0001_baseline.sql
npm run db:check-drift
```
Expected: ‏lint ירוק, push מחיל מיגרציה אחת, drift ‏`✅`.

- [ ] **Step 3: ודא שבדיקת ה־tenant עוברת** (הטבלה החדשה עם `municipality_id`)

Run: `npx vitest run tests/tenant-columns.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations supabase/baseline/0001_baseline.sql
git commit -m "feat: daily_reports table — JSONB snapshot per production (YOA-42)"
```

---

### Task 4: ראוטים — `/api/daily-report`

**Files:**
- Create: `app/api/daily-report/route.js`
- Test: `tests/daily-report-api.test.js`

**Interfaces:**
- Consumes: ‏`requireRole` מ־`@/lib/auth`; ‏`supabase` מ־`@/lib/supabase-server`.
- Produces:
  - `GET /api/daily-report?limit=N` → ‏`{ success, data: [{id, report_date, produced_at, produced_by_name, source_file_name, snapshot}] }` ממוין `produced_at` יורד. משמש להיסטוריה, ל־prefill של מקטעים 4–5 מהדוח האחרון, ולתגי "חדש מאז".
  - `POST /api/daily-report` — גוף: ‏`{ report_date: 'YYYY-MM-DD', source_file_name, snapshot }` → שומר שורה עם `produced_by`/`produced_by_name` מהטוקן ו־`municipality_id` מהפרופיל, ומחזיר `{ success, data }`.
  - שני הראוטים: ‏`requireRole(request, ['shift_supervisor', 'call_center_manager'])`.

- [ ] **Step 1: כתוב בדיקות** ב־`tests/daily-report-api.test.js` (מוק מקליט בסגנון `tests/leave-import.test.js`):

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signToken } from '@/lib/auth';
import { makeRequest } from './helpers/request';

const { calls, chain } = vi.hoisted(() => {
  const calls = [];
  function chain(table) {
    return new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === 'then') {
          const result =
            table === 'user_profiles'
              ? { data: { municipality_id: 'muni-1' }, error: null }
              : { data: [], error: null };
          return (resolve) => resolve(result);
        }
        if (prop === Symbol.toPrimitive || prop === 'toJSON') return undefined;
        return (arg) => {
          if (prop === 'insert') calls.push({ table, rows: arg });
          return chain(table);
        };
      },
      apply() { return chain(table); },
    });
  }
  return { calls, chain };
});

vi.mock('@/lib/supabase-server', () => ({ supabase: { from: (t) => chain(t) } }));

const asRole = (role, options = {}) =>
  makeRequest('/api/daily-report', {
    ...options,
    cookies: { 'auth-token': signToken({ userId: 'u1', role, name: 'אחמ"שית בודקת' }) },
  });

describe('/api/daily-report — הרשאות', () => {
  it.each(['GET', 'POST'])('%s חסום למוקדן ולמנהל מכלול', async (method) => {
    const mod = await import('@/app/api/daily-report/route');
    for (const role of ['operator', 'sector_manager']) {
      const res = await mod[method](asRole(role, { method, body: {} }));
      expect(res.status, `${role} ${method}`).toBe(403);
    }
  });

  it.each(['shift_supervisor', 'call_center_manager'])('%s עובר', async (role) => {
    const mod = await import('@/app/api/daily-report/route');
    const res = await mod.GET(asRole(role));
    expect(res.status).toBe(200);
  });
});

describe('POST — שמירת דוח', () => {
  beforeEach(() => { calls.length = 0; });

  it('שומר snapshot עם זהות המפיק והרשות מהשרת', async () => {
    const mod = await import('@/app/api/daily-report/route');
    const res = await mod.POST(
      asRole('shift_supervisor', {
        method: 'POST',
        body: {
          report_date: '2026-08-18',
          source_file_name: 'tickets.csv',
          snapshot: { ticket_ids: ['1'], exceptional: [] },
        },
      })
    );
    expect(res.status).toBe(200);
    const insert = calls.find(c => c.table === 'daily_reports');
    expect(insert.rows.report_date).toBe('2026-08-18');
    expect(insert.rows.produced_by).toBe('u1');
    expect(insert.rows.municipality_id).toBe('muni-1');
    expect(insert.rows.snapshot.ticket_ids).toEqual(['1']);
  });

  it('דוחה גוף בלי snapshot או תאריך', async () => {
    const mod = await import('@/app/api/daily-report/route');
    const res = await mod.POST(
      asRole('shift_supervisor', { method: 'POST', body: { report_date: '2026-08-18' } })
    );
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: הרץ וודא כשל** — `npx vitest run tests/daily-report-api.test.js` → FAIL (המודול לא קיים).

- [ ] **Step 3: כתוב את `app/api/daily-report/route.js`:**

```javascript
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';

// דוח הסיכום היומי (YOA-42, docs/16): הפקה ואישור הם סמכות משמרת -
// אחמ"ש ומנהלת המוקד בלבד, כמו ההודעות ומצב החירום.
const ROLES = ['shift_supervisor', 'call_center_manager'];

export async function GET(request) {
  try {
    const auth = await requireRole(request, ROLES);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 30, 100);

    const { data, error } = await supabase
      .from('daily_reports')
      .select('*')
      .order('produced_at', { ascending: false })
      .limit(limit);
    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await requireRole(request, ROLES);
    if (auth.error) return auth.error;

    const { report_date, source_file_name, snapshot } = await request.json();
    if (!report_date || !snapshot || typeof snapshot !== 'object') {
      return NextResponse.json(
        { success: false, error: 'report_date ו-snapshot נדרשים' },
        { status: 400 }
      );
    }

    // הרשות מהפרופיל בשרת, לא מהבקשה (העיקרון של YOA-29)
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('municipality_id')
      .eq('id', auth.user.userId)
      .single();
    if (profileError) throw profileError;

    const { data, error } = await supabase
      .from('daily_reports')
      .insert({
        municipality_id: profile?.municipality_id || null,
        report_date,
        produced_by: auth.user.userId,
        produced_by_name: auth.user.name || null,
        source_file_name: source_file_name || null,
        snapshot,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

הערה: ‏`municipality_id` הוא `not null` בסכימה — אם הפרופיל בלי רשות ה־insert ייכשל ברעש. זה מכוון (כל 21 המשתמשים נושאים רשות מאז YOA-29).

- [ ] **Step 4: הרץ את הבדיקות** — `npx vitest run tests/daily-report-api.test.js` → PASS.

- [ ] **Step 5: הרץ את כל החבילה** — ‏`npx vitest run` — שים לב ש־`api-auth-contract` מזהה את הראוט החדש אוטומטית ודורש 401 בלי עוגייה; אם נכשל — ‏`requireRole` חייב להיות לפני כל דבר אחר.

- [ ] **Step 6: Commit**

```bash
git add app/api/daily-report/route.js tests/daily-report-api.test.js
git commit -m "feat: daily-report API — history and snapshot save, shift authority (YOA-42)"
```

---

### Task 5: בונה ה־Excel — `lib/daily-report-excel.js`

**Files:**
- Create: `lib/daily-report-excel.js`
- Test: `tests/daily-report-excel.test.js`

**Interfaces:**
- Consumes: ‏snapshot כפי שהוגדר ב־Task 4.
- Produces: ‏`buildReportRows(snapshot, reportDateLabel) -> any[][]` — מערך שורות (aoa) בפורמט הדוח האמיתי; ‏`buildReportWorkbook(snapshot, reportDateLabel) -> Workbook` (של ספריית `xlsx`) עם גיליון "גיליון1". ההפרדה קיימת כדי שהבדיקות ירוצו על `buildReportRows` בלי קבצים.

**פורמט הפלט — העתק מדויק של הדוח האמיתי (מתוך "דוח סיכום יומי 18.08.2026.xlsx"):**

```
R1:  [כותרת: "דוח סיכום יומי <תווית תאריך>"]
R2:  (ריק)
R3:  ["אגף", "קריאות שנפתחו", "קריאות שטופלו", "סך כל הקריאות הפתוחות", "קריאות חורגות מתוך הפתוחות"]
R4-7: שורה לכל אגף: שפ"ע, בטחון, חינוך, הנדסה
R8:  (ריק)
R9:  ["תקינות מצלמות", "מספר מצלמות"]
R10: ["תקין", <ok>] ; R11: ["לא תקין", <broken>]
R12: (ריק)
R13: ["אירועים חריגים"]
R14: ["שעה ותאריך", "תיאור האירוע", "דרך טיפול", "גורם מטפל"]
R15+: שורה לכל אירוע: [<שעה כטקסט "DD.MM HH:MM">, "מספר פנייה: X\nמיקום: Y\nתיאור הפנייה: Z", "טיפול בפנייה: ...", <גורם>]
אחרי החריגים: ["אירועים בעיר", "תאריך", "שעה"] ואז שורה לכל אירוע [שם, תאריך, שעה]
אחרי האירועים: ["פרוייקט", "תאריך התחלה", "תאריל משוער לסיום", "אחריות"] ואז שורה לכל עבודה
שורה לפני אחרונה: ["", "כותב/ת הדוח: <שם>"]
שורה אחרונה:      ["", "מאשרת את הדוח : מירי צרפתי"]
```

("תאריל" — כך במקור בדוח הקיים; שמור על זה זהה כדי שהרשימה לא תרגיש שינוי.)

- [ ] **Step 1: כתוב בדיקות** ב־`tests/daily-report-excel.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { buildReportRows } from '@/lib/daily-report-excel';

const SNAPSHOT = {
  agaf: {
    'שפ"ע': { opened: 97, handled: 57, open_total: 107, overdue: 8 },
    'בטחון': { opened: 33, handled: 26, open_total: 21, overdue: 9 },
    'חינוך': { opened: 4, handled: 0, open_total: 76, overdue: 44 },
    'הנדסה': { opened: 12, handled: 3, open_total: 60, overdue: 29 },
  },
  cameras: { ok: 106, broken: 1 },
  exceptional: [
    {
      ticket_id: '600005',
      time_label: '16.08 07:50',
      description: 'מספר פנייה: 600005\nמיקום: גן הפקאן\nתיאור הפנייה: אדם מבוגר נפל בגן',
      treatment: 'טיפול בפנייה: פקח ביצע חבישה עד הגעת מד"א',
      handler: 'פיקוח',
    },
  ],
  city_events: [{ name: 'זומבה ביובל', date: '18.08.2026', hour: '20:00' }],
  works: [{ description: 'עבודות נת"ע בכביש 461', start: '16.08.2026', end: '20.08.2026', owner: 'נת"ע' }],
  writer_name: 'דנה אהרון',
};

describe('buildReportRows — הפורמט של הדוח הקיים', () => {
  const rows = buildReportRows(SNAPSHOT, 'יום שלישי 18.08.2026');

  it('כותרת, טבלת אגפים ומצלמות במקומן', () => {
    expect(rows[0][0]).toBe('דוח סיכום יומי יום שלישי 18.08.2026');
    expect(rows[2][0]).toBe('אגף');
    expect(rows[3]).toEqual(['שפ"ע', 97, 57, 107, 8]);
    expect(rows[8][0]).toBe('תקינות מצלמות');
    expect(rows[9]).toEqual(['תקין', 106]);
  });

  it('אירוע חריג עם כל ארבע העמודות', () => {
    const i = rows.findIndex(r => r[0] === 'אירועים חריגים');
    expect(rows[i + 1][0]).toBe('שעה ותאריך');
    expect(rows[i + 2][1]).toContain('מספר פנייה: 600005');
    expect(rows[i + 2][3]).toBe('פיקוח');
  });

  it('אירועים בעיר, עבודות, וחתימות בסוף', () => {
    const events = rows.findIndex(r => r[0] === 'אירועים בעיר');
    expect(rows[events + 1][0]).toBe('זומבה ביובל');
    const works = rows.findIndex(r => r[0] === 'פרוייקט');
    expect(rows[works + 1][3]).toBe('נת"ע');
    expect(rows[rows.length - 2][1]).toBe('כותב/ת הדוח: דנה אהרון');
    expect(rows[rows.length - 1][1]).toBe('מאשרת את הדוח : מירי צרפתי');
  });
});
```

- [ ] **Step 2: הרץ וודא כשל** — `npx vitest run tests/daily-report-excel.test.js` → FAIL.

- [ ] **Step 3: כתוב את `lib/daily-report-excel.js`:**

```javascript
import * as XLSX from 'xlsx';

/**
 * בונה את דוח הסיכום היומי בפורמט המדויק של הדוח הידני הקיים (YOA-42),
 * כדי שרשימת התפוצה במייל לא תרגיש שום שינוי. "תאריל" - כך במקור.
 */
const AGAF_ORDER = ['שפ"ע', 'בטחון', 'חינוך', 'הנדסה'];

export function buildReportRows(snapshot, reportDateLabel) {
  const rows = [];
  rows.push([`דוח סיכום יומי ${reportDateLabel}`]);
  rows.push([]);
  rows.push(['אגף', 'קריאות שנפתחו', 'קריאות שטופלו', 'סך כל הקריאות הפתוחות', 'קריאות חורגות מתוך הפתוחות']);
  for (const name of AGAF_ORDER) {
    const a = snapshot.agaf?.[name] || {};
    rows.push([name, a.opened ?? '', a.handled ?? '', a.open_total ?? '', a.overdue ?? '']);
  }
  rows.push([]);
  rows.push(['תקינות מצלמות', 'מספר מצלמות']);
  rows.push(['תקין', snapshot.cameras?.ok ?? '']);
  rows.push(['לא תקין', snapshot.cameras?.broken ?? '']);
  rows.push([]);
  rows.push(['אירועים חריגים']);
  rows.push(['שעה ותאריך', 'תיאור האירוע', 'דרך טיפול', 'גורם מטפל']);
  for (const e of snapshot.exceptional || []) {
    rows.push([e.time_label, e.description, e.treatment, e.handler]);
  }
  rows.push(['אירועים בעיר', 'תאריך', 'שעה']);
  for (const ev of snapshot.city_events || []) {
    rows.push([ev.name, ev.date, ev.hour]);
  }
  rows.push(['פרוייקט', 'תאריך התחלה', 'תאריל משוער לסיום', 'אחריות']);
  for (const w of snapshot.works || []) {
    rows.push([w.description, w.start, w.end, w.owner]);
  }
  rows.push(['', `כותב/ת הדוח: ${snapshot.writer_name || ''}`]);
  rows.push(['', 'מאשרת את הדוח : מירי צרפתי']);
  return rows;
}

export function buildReportWorkbook(snapshot, reportDateLabel) {
  const ws = XLSX.utils.aoa_to_sheet(buildReportRows(snapshot, reportDateLabel));
  ws['!cols'] = [{ wch: 30 }, { wch: 60 }, { wch: 40 }, { wch: 18 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'גיליון1');
  return wb;
}
```

- [ ] **Step 4: הרץ וודא ירוק** — הקובץ + כל החבילה: `npx vitest run` → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/daily-report-excel.js tests/daily-report-excel.test.js
git commit -m "feat: daily report Excel builder — pixel-faithful to the manual format (YOA-42)"
```

---

### Task 6: דף `/daily-report` — העלאה, Preview, הפקה, היסטוריה

**Files:**
- Create: `app/daily-report/page.js`
- Modify: `middleware.js` — הוספת `/daily-report` ל־matcher ולמיפוי התפקידים (עיין איך `/shift` מוגדר שם ועשה אותו דבר עם `shift_supervisor` + `call_center_manager`)
- Test: קיים — `tests/page-gates.test.js` יכשל אם הדף לא ב־matcher; אין בדיקות קומפוננטות בפרויקט (מוסכם) — אימות UI בדפדפן ב־Task 7.

**Interfaces:**
- Consumes: ‏`parseTicketsCsv`, ‏`prepareTickets`, ‏`reportWindow` מ־`@/lib/binaa-tickets` (רצים בצד הלקוח — קריאת הקובץ ב־FileReader כטקסט); ‏`buildReportWorkbook` מ־`@/lib/daily-report-excel`; ‏`GET/POST /api/daily-report`.
- Produces: הדף השמיש היחיד של שלב 1.

**התנהגות (מפורט; אין קוד מלא לדף — הוא ארוך — אבל כל התנהגות מוגדרת כאן והדפוסים קיימים בקודבייס):**

- [ ] **Step 1: הוסף את הדף ל־middleware** (עקוב אחרי הדפוס של `/shift`), הרץ `npx vitest run tests/page-gates.test.js` וודא שהוא עובר **רק אחרי** ההוספה (הרץ קודם בלעדיה וראה אדום — זו בדיקת השיניים).

- [ ] **Step 2: בנה את הדף** במבנה הבא (השתמש בדפוסי ה־UI של `/shift` — כותרת גרדיאנט, sections לבנים; RTL):

  1. **כותרת** "דוח סיכום יומי" + מי מחובר.
  2. **מסך ראשי:** `<input type="file" accept=".csv">` בעיצוב אזור גרירה (הדפוס של ExcelImporter) + רשימת היסטוריה מ־`GET /api/daily-report` — תאריך, שעת הפקה, מפיק, כפתור "הורד Excel" (בונה מחדש מה־snapshot עם `buildReportWorkbook` ו־`XLSX.writeFile`).
  3. **בבחירת קובץ:** קריאה כטקסט → `parseTicketsCsv` → תאריך הדוח = היום המאוחר ביותר בקובץ → `prepareTickets` → אם קיים כבר דוח לאותו `report_date` בהיסטוריה: פס אזהרה צהוב "כבר הופק דוח לתאריך זה ב־HH:MM ע"י X — הפקה חדשה תתווסף להיסטוריה" (לא חוסם). מעבר ל־Preview.
  4. **Preview — לפי סדר הדוח:**
     - טבלת אגפים: 16 `<input type="number">` (4 אגפים × 4). אם יש דוח קודם בהיסטוריה — הערכים שלו מוצגים באפור ליד כל שדה.
     - מצלמות: 2 שדות, ברירת מחדל מהדוח הקודם.
     - **אירועים חריגים (הלב):** טבלת כל פניות היום (אחרי איחוד) עם חיפוש טקסט חופשי; כל שורה: שעה, מחלקה, תיאור מקוצר, וכפתור "➕ לדוח". פנייה שנוספה עוברת לרשימת הנבחרות עם שלושה שדות עריכה מאוכלסים אוטומטית: תיאור (`מספר פנייה: {id}\nמיקום: {address}\nתיאור הפנייה: {description}`), דרך טיפול (`טיפול בפנייה: {lastTreatment}`), גורם מטפל (`{handler}`) — כולם ניתנים לעריכה, ✕ להסרה. אם קיים דוח קודם לאותו יום — פניות שלא הופיעו ב־`snapshot.ticket_ids` שלו מסומנות בתגית כתומה "חדש מאז ההפקה הקודמת".
     - אירועים בעיר + עבודות: טבלאות שורות טקסט חופשי, **מאוכלסות מראש מהדוח האחרון בהיסטוריה** (זה מה שהורג את ההעתק־מחק כבר בשלב 1; הסינון האוטומטי לפי תאריכים — שלב 3). הוספה/עריכה/מחיקה חופשית.
  5. **"הפק דוח":** בונה snapshot (כולל `ticket_ids` של כל פניות היום ו־`writer_name` מהמשתמש המחובר) → `POST /api/daily-report` → ‏`buildReportWorkbook` + ‏`XLSX.writeFile(wb, 'דוח סיכום יומי {DD.MM.YYYY}.xlsx')` → טוסט הצלחה + חזרה למסך הראשי עם ההיסטוריה המעודכנת.
  6. תווית תאריך הדוח: יום חול — "יום {שם} {DD.MM.YYYY}"; ראשון — "יום סופ\"ש {DD-DD.MM.YYYY}" (כמו בדוח האמיתי).

- [ ] **Step 3: כפתור כניסה** — הוסף ב־`/shift` (אחרי סקשן ההודעות) קישור: "📄 דוח סיכום יומי" אל `/daily-report`.

- [ ] **Step 4: lint + כל הבדיקות** — `npx next lint && npx vitest run` → נקי וירוק.

- [ ] **Step 5: Commit**

```bash
git add app/daily-report/page.js middleware.js app/shift/page.js
git commit -m "feat: daily-report page — upload, manual preview, Excel production, history (YOA-42)"
```

---

### Task 7: אימות בדפדפן מקצה לקצה

**Files:** אין שינויי קוד מתוכננים (תיקונים אם יימצאו).

- [ ] **Step 1: הפעל שרת** — ‏preview_start עם `miklaton-dev` (לא Bash).
- [ ] **Step 2: היכנס כאחמ"ש** (חתימת JWT מקומית — הדפוס הקיים בסשנים קודמים; נקה עוגייה קודם דרך `/api/auth/logout`).
- [ ] **Step 3: העלה את ה־fixture** (`tests/fixtures/binaa-tickets-sample.csv` דרך `/public/__test.csv` הזמני והזרקת File — הדפוס מ־YOA-35) וודא: תאריך הדוח מזוהה כ"יום סופ"ש 14-16.08.2026" (הפנייה המאוחרת בקובץ היא מיום ראשון), הפנייה־הבת לא מופיעה, הכפילות של "הדקל 4" מקובצת.
- [ ] **Step 4: הוסף לדוח** את פניית "אדם מבוגר נפל" — ודא שהשדות התאכלסו; מלא 2–3 מספרי אגפים; הפק. ודא: קובץ Excel ירד, שורת היסטוריה נוצרה.
- [ ] **Step 5: העלה שוב את אותו קובץ** — ודא אזהרת הדריסה + תגי "חדש מאז" לא מופיעים (אין פניות חדשות).
- [ ] **Step 6: פתח את ה־Excel שהורד** (בסקריפט node עם xlsx) והשווה מול `buildReportRows` — הכותרות והחתימות במקומן.
- [ ] **Step 7: נקה** (עוגייה, `/public/__test.csv`), עצור שרת, commit לתיקונים אם היו, push, המתן לדיפלוי וודא `/api/version`.
- [ ] **Step 8: עדכן את YOA-42** — הערה: שלב 1 הושלם, מה אומת, ומה השלב הבא (AI).

---

## Self-Review (בוצע בכתיבה)

- **כיסוי ספק לשלב 1:** העלאה ✓ פענוח+איחוד+חלון ✓ Preview ידני ✓ אגפים/מצלמות ידני ✓ prefill מקטעים 4–5 מהדוח הקודם ✓ Excel בפורמט ✓ היסטוריה ✓ אזהרת דריסה ✓ "חדש מאז" ✓ חתימות ✓ הרשאות ✓ tenant ✓. מחוץ לשלב: AI, משיכת אירועים, רשימת עבודות עם תאריכים, PDF — מתועדים בספק כשלבים 2–4.
- **עקביות טיפוסים:** ‏snapshot מוגדר ב־Task 4 ונצרך ב־5 ו־6 באותם שמות שדות; ‏Ticket מוגדר ב־Task 2 ונצרך ב־6.
- **אין placeholders** — כל קוד מופיע במלואו מלבד דף ה־UI, שהוגדר התנהגותית סעיף־סעיף עם הפניות לדפוסים קיימים בקודבייס (מוסכמת הפרויקט: אין בדיקות קומפוננטות; האימות בדפדפן, Task 7).
