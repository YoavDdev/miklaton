# Holiday Duty Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** לתת למנהל המוקד מקום אחד לרכז את כונני החג שהמחלקות מוסרות טלפונית, ולמוקדן מסך שאומר למי להתקשר — במקום דף נייר.

**Architecture:** שלוש טבלאות (`holiday_periods`, `holiday_duty_topics`, `holiday_duty_entries`) מתארות לוח חג אחד לכל חג. תאריכי החגים נזרעים חד-פעמית מ-Hebcal ומשמשים גם כמקור האמת לשאלה "האם עכשיו חג" עבור מנוע הזמינות הקיים. הלוגיקה של החישוב היא מודול טהור נטול I/O, ולכן נבדקת מול פיקסצ'ר אמיתי בלי רשת.

**Tech Stack:** Next.js 14 App Router, Supabase (service role בלבד), vitest, Tailwind, jsPDF + html2canvas.

**Spec:** `docs/superpowers/specs/2026-09-10-holiday-duty-design.md`

## Global Constraints

- כל הראוטים תחת `app/api/` חייבים `requireRole` — `tests/api-auth-contract.test.js` נכשל אחרת. אין להוסיף ל-`PUBLIC_ROUTES`.
- כל דף חדש תחת `app/` חייב רישום גם ב-`ROUTE_PERMISSIONS` וגם ב-`config.matcher` שב-`middleware.js` — `tests/page-gates.test.js` נכשל אחרת.
- כל טבלה חדשה חייבת עמודת `municipality_id` — `tests/tenant-columns.test.js` אוכף זאת.
- שם קובץ מיגרציה חייב להיות `<14 ספרות>_name.sql` — `npm run db:lint-migrations` נכשל אחרת.
- גישה ל-Supabase מצד שרת אך ורק דרך `import { supabase } from '@/lib/supabase-server'`. אין ליצור `createClient` בראוט.
- כל חישובי הזמן באזור `Asia/Jerusalem`.
- כל טקסט המוצג למשתמש בעברית, `dir="rtl"`.
- אין תלות npm חדשה.

---

## File Structure

**Create**
- `lib/holidays.js` — לוגיקה טהורה: בניית תקופות מ-Hebcal, איתור תקופה פעילה, יום שבוע אפקטיבי. אפס I/O.
- `lib/holiday-duty-db.js` — טעינת תקופות מ-Supabase עם מטמון קצר. הגבול היחיד בין הלוגיקה ל-DB.
- `scripts/seed-holidays.js` — זריעה חד-פעמית של חגי תשפ"ז ותשפ"ח.
- `supabase/migrations/20260910120000_holiday_duty.sql`
- `app/api/holiday-duty/route.js` — GET לוח מלא
- `app/api/holiday-duty/periods/route.js` — GET רשימת חגים
- `app/api/holiday-duty/periods/[id]/seed/route.js` — POST זריעת טיוטה מהמדריך או שכפול מחג קודם
- `app/api/holiday-duty/topics/route.js` + `topics/[id]/route.js`
- `app/api/holiday-duty/entries/route.js` + `entries/[id]/route.js`
- `app/api/holiday-duty/contacts/route.js` — בורר אנשי קשר משתי הטבלאות
- `components/HolidayDutyBoard.js` — רינדור קריאה בלבד. משותף לדף המוקדן ולמסך הקיר.
- `components/HolidayDutyManager.js` — עורך
- `components/HolidayBanner.js` — באנר
- `app/holiday-duty/page.js`
- `tests/holidays.test.js`, `tests/holiday-duty-api.test.js`
- `tests/fixtures/hebcal-5787.json` — כבר קיים

**Modify**
- `middleware.js` — `/holiday-duty`
- `app/call-center-manager/page.js` — לשונית
- `app/operator/page.js` — באנר
- `app/api/call-categories/route.js` — תיקון זיהוי חג (שלב 2)
- `app/screen/page.js` — פאנל חג (שלב 2)

**חלוקה לשלבים:** משימות 1–6 הן שלב 1 ונדרשות לפני כניסת ראש השנה. משימות 7–8 הן שלב 2.

---

## Task 1: מודול החגים הטהור

**Files:**
- Create: `lib/holidays.js`
- Test: `tests/holidays.test.js`
- Fixture: `tests/fixtures/hebcal-5787.json` (קיים)

**Interfaces:**
- Consumes: כלום. מודול טהור.
- Produces:
  - `buildPeriodsFromHebcal(items) -> [{ name, days: string[], starts_at: string, ends_at: string }]`
  - `findActivePeriod(periods, now: Date) -> period | null`
  - `findUpcomingPeriod(periods, now: Date, withinHours: number) -> period | null`
  - `isHolidayNow(periods, now: Date) -> boolean`
  - `effectiveDayOfWeek(periods, now: Date) -> 0..6`
  - תקופה היא `{ id?, name, starts_at, ends_at }` כאשר `starts_at`/`ends_at` הן מחרוזות ISO עם היסט.

- [ ] **Step 1: כתוב את הבדיקות הנכשלות**

```javascript
// tests/holidays.test.js
import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import {
  buildPeriodsFromHebcal,
  findActivePeriod,
  findUpcomingPeriod,
  isHolidayNow,
  effectiveDayOfWeek,
} from '@/lib/holidays';

const fixture = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/hebcal-5787.json'), 'utf8')
);

describe('buildPeriodsFromHebcal', () => {
  const periods = buildPeriodsFromHebcal(fixture.items);

  it('מוצא שבע תקופות חג בתשפ״ז', () => {
    expect(periods).toHaveLength(7);
  });

  it('מאחד את ראש השנה לרצף אחד של שלושה ימים', () => {
    expect(periods[0]).toMatchObject({
      name: 'ראש השנה 5787',
      starts_at: '2026-09-11T18:32:00+03:00',
      ends_at: '2026-09-13T19:26:00+03:00',
    });
    expect(periods[0].days).toEqual(['2026-09-12', '2026-09-13']);
  });

  it('לא בולע שבתות רגילות כתקופות חג', () => {
    // 18-19.9.2026 היא שבת רגילה עם הדלקה והבדלה, ואינה חג
    expect(periods.some((p) => p.starts_at.startsWith('2026-09-18'))).toBe(false);
  });

  it('מותח את שבועות עד מוצאי שבת כשהחג צמוד לשבת', () => {
    const shavuot = periods.find((p) => p.name === 'שבועות');
    expect(shavuot.starts_at).toBe('2027-06-10T19:26:00+03:00');
    expect(shavuot.ends_at).toBe('2027-06-12T20:30:00+03:00');
  });
});

describe('findActivePeriod', () => {
  const periods = buildPeriodsFromHebcal(fixture.items);

  it('מזהה את ראש השנה בתוך החג', () => {
    const now = new Date('2026-09-12T10:00:00+03:00');
    expect(findActivePeriod(periods, now).name).toBe('ראש השנה 5787');
  });

  it('מזהה את יום ראשון 13.9 כחג — זה המקרה ששובר את לוח השבוע', () => {
    const now = new Date('2026-09-13T09:00:00+03:00');
    expect(findActivePeriod(periods, now).name).toBe('ראש השנה 5787');
  });

  it('דקה לפני ההדלקה עדיין אינו חג', () => {
    expect(findActivePeriod(periods, new Date('2026-09-11T18:31:00+03:00'))).toBeNull();
  });

  it('בדיוק ברגע ההדלקה כבר חג', () => {
    expect(findActivePeriod(periods, new Date('2026-09-11T18:32:00+03:00'))).not.toBeNull();
  });

  it('אחרי ההבדלה אינו חג', () => {
    expect(findActivePeriod(periods, new Date('2026-09-13T19:27:00+03:00'))).toBeNull();
  });
});

describe('effectiveDayOfWeek', () => {
  const periods = buildPeriodsFromHebcal(fixture.items);

  it('מחזיר 6 ביום ראשון שהוא חג', () => {
    expect(effectiveDayOfWeek(periods, new Date('2026-09-13T09:00:00+03:00'))).toBe(6);
  });

  it('מחזיר 0 ביום ראשון רגיל', () => {
    expect(effectiveDayOfWeek(periods, new Date('2026-09-06T09:00:00+03:00'))).toBe(0);
  });

  it('מחזיר 6 בשבת רגילה', () => {
    expect(effectiveDayOfWeek(periods, new Date('2026-09-19T09:00:00+03:00'))).toBe(6);
  });

  it('מחשב לפי אזור זמן ישראל ולא לפי UTC', () => {
    // 13.9 בשעה 22:30 UTC הוא כבר 14.9 בישראל — יום שני, ואחרי צאת החג
    expect(effectiveDayOfWeek(periods, new Date('2026-09-13T22:30:00Z'))).toBe(1);
  });
});

describe('findUpcomingPeriod', () => {
  const periods = buildPeriodsFromHebcal(fixture.items);

  it('מחזיר את ראש השנה 24 שעות לפניו', () => {
    const now = new Date('2026-09-10T18:00:00+03:00');
    expect(findUpcomingPeriod(periods, now, 48).name).toBe('ראש השנה 5787');
  });

  it('מחזיר null כשהחג רחוק מהחלון', () => {
    expect(findUpcomingPeriod(periods, new Date('2026-09-01T09:00:00+03:00'), 48)).toBeNull();
  });

  it('אינו מחזיר תקופה שכבר התחילה', () => {
    expect(findUpcomingPeriod(periods, new Date('2026-09-12T09:00:00+03:00'), 48)).toBeNull();
  });
});

describe('isHolidayNow', () => {
  const periods = buildPeriodsFromHebcal(fixture.items);

  it('אמת בתוך החג, שקר מחוצה לו', () => {
    expect(isHolidayNow(periods, new Date('2026-09-21T12:00:00+03:00'))).toBe(true);
    expect(isHolidayNow(periods, new Date('2026-09-23T12:00:00+03:00'))).toBe(false);
  });

  it('אינו קורס על רשימה ריקה', () => {
    expect(isHolidayNow([], new Date())).toBe(false);
  });
});
```

- [ ] **Step 2: הרץ את הבדיקות וודא שהן נכשלות**

```bash
npx vitest run tests/holidays.test.js
```

צפוי: כישלון עם `Failed to resolve import "@/lib/holidays"`.

- [ ] **Step 3: כתוב את המימוש המינימלי**

```javascript
// lib/holidays.js
/**
 * לוגיקת חגים טהורה, בלי גישה לרשת ובלי DB.
 *
 * למה מודול נפרד: השאלה "האם עכשיו חג" מכריעה מי מוצג למוקדן בשלוש נקודות
 * שונות בקוד. כשהיא מפוזרת היא נשברת בשקט — בדיוק מה שקרה עם `available_days`,
 * שמחזיר את צוות יום החול ביום ראשון שהוא חג. כאן היא במקום אחד ומכוסה בבדיקות.
 */

const ISRAEL_TZ = 'Asia/Jerusalem';

const dayOf = (iso) => iso.slice(0, 10);

function addDays(isoDate, n) {
  const t = new Date(`${isoDate}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/**
 * הופך את פלט Hebcal לתקופות חג רציפות.
 *
 * ימי יום-טוב עוקבים מתמזגים לתקופה אחת (ראש השנה = יומיים), והתקופה נמתחת
 * מההדלקה שלפני היום הראשון ועד ההבדלה הראשונה שאחרי היום האחרון. כשחג צמוד
 * לשבת אין הבדלה ביניהם, ולכן התקופה נמתחת נכון עד מוצאי שבת.
 */
export function buildPeriodsFromHebcal(items) {
  const yomtov = items
    .filter((i) => i.yomtov === true)
    .map((i) => ({ date: dayOf(i.date), hebrew: i.hebrew }));
  const candles = items.filter((i) => i.category === 'candles');
  const havdalah = items.filter((i) => i.category === 'havdalah');

  const blocks = [];
  for (const y of yomtov) {
    const last = blocks[blocks.length - 1];
    if (last && addDays(last.days[last.days.length - 1], 1) === y.date) {
      last.days.push(y.date);
    } else {
      blocks.push({ days: [y.date], name: y.hebrew });
    }
  }

  return blocks
    .map((b) => {
      const firstDay = b.days[0];
      const lastDay = b.days[b.days.length - 1];
      const start = candles.find((c) => dayOf(c.date) === addDays(firstDay, -1));
      const end = havdalah.find((h) => dayOf(h.date) >= lastDay);
      if (!start || !end) return null;
      return { name: b.name, days: b.days, starts_at: start.date, ends_at: end.date };
    })
    .filter(Boolean);
}

export function findActivePeriod(periods, now = new Date()) {
  const t = now.getTime();
  return (
    (periods || []).find(
      (p) => t >= new Date(p.starts_at).getTime() && t <= new Date(p.ends_at).getTime()
    ) || null
  );
}

export function findUpcomingPeriod(periods, now = new Date(), withinHours = 48) {
  const t = now.getTime();
  const limit = t + withinHours * 3600 * 1000;
  const future = (periods || [])
    .filter((p) => {
      const start = new Date(p.starts_at).getTime();
      return start > t && start <= limit;
    })
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  return future[0] || null;
}

export function isHolidayNow(periods, now = new Date()) {
  return findActivePeriod(periods, now) !== null;
}

/** יום השבוע בישראל, 0=ראשון. */
export function israelDayOfWeek(now = new Date()) {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: ISRAEL_TZ,
    weekday: 'short',
  }).format(now);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

/**
 * יום השבוע שלפיו יש להעריך `available_days`.
 *
 * בחג מוחזר 6 — "חגים זה כמו שישי שבת". בלי זה, ביום ראשון שהוא חג המערכת
 * בוחרת את צוות יום החול ושולחת את המוקדן לכונן הלא נכון.
 */
export function effectiveDayOfWeek(periods, now = new Date()) {
  if (isHolidayNow(periods, now)) return 6;
  return israelDayOfWeek(now);
}
```

- [ ] **Step 4: הרץ את הבדיקות וודא שהן עוברות**

```bash
npx vitest run tests/holidays.test.js
```

צפוי: כל הבדיקות עוברות.

- [ ] **Step 5: הרץ את כל הבדיקות כדי לוודא שכלום לא נשבר**

```bash
npm test
```

- [ ] **Step 6: Commit**

```bash
git add lib/holidays.js tests/holidays.test.js tests/fixtures/hebcal-5787.json
git commit -m "feat: מודול חגים טהור - זיהוי תקופת חג ויום שבוע אפקטיבי"
```

---

## Task 2: מיגרציה וזריעת חגי תשפ״ז

**Files:**
- Create: `supabase/migrations/20260910120000_holiday_duty.sql`
- Create: `scripts/seed-holidays.js`
- Create: `lib/holiday-duty-db.js`

**Interfaces:**
- Consumes: `buildPeriodsFromHebcal` מ-Task 1.
- Produces:
  - `loadPeriods(municipalityId) -> Promise<period[]>` — עם מטמון של 60 שניות
  - `getActivePeriodId(municipalityId) -> Promise<string|null>`

- [ ] **Step 1: כתוב את המיגרציה**

```sql
-- supabase/migrations/20260910120000_holiday_duty.sql
-- כוננות חג. לפני כל חג מנהל המוקד מתקשר לכל המחלקות ורושם על דף מי כונן.
-- הדף אובד ואינו נגיש למוקדן במשמרת לילה. שלוש הטבלאות כאן הן אותו דף,
-- רק שהוא נשמר, נגיש, ויש לו היסטוריה.

create table public.holiday_periods (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null,
  name text not null,
  slug text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (municipality_id, slug),
  check (ends_at > starts_at)
);

-- status נוגע לתוכן הלוח בלבד. התאריכים תקפים תמיד, גם בטיוטה, כי מנוע
-- הזמינות שואל את הטבלה הזו "האם עכשיו חג" ללא קשר למי מילא את הלוח.
comment on column public.holiday_periods.status is
  'שלב עריכת הלוח בלבד. אינו משפיע על זיהוי החג במנוע הזמינות.';

create index holiday_periods_window on public.holiday_periods (municipality_id, starts_at, ends_at);

create table public.holiday_duty_topics (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null,
  holiday_period_id uuid not null references public.holiday_periods(id) on delete cascade,
  call_category_id uuid references public.call_categories(id) on delete set null,
  name text not null,
  display_order integer not null default 0,
  status text not null default 'pending' check (status in ('pending','confirmed')),
  confirmed_by_name text,
  confirmed_at timestamptz,
  instructions text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.holiday_duty_topics.status is
  'מעקב סבב הטלפונים: pending = טרם עודכן מהמחלקה.';

create index holiday_duty_topics_period on public.holiday_duty_topics (holiday_period_id, display_order);

create table public.holiday_duty_entries (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null,
  topic_id uuid not null references public.holiday_duty_topics(id) on delete cascade,
  subtopic text,
  contact_name text not null,
  contact_phone text,
  contact_role text,
  source_contact_id uuid,
  source_table text check (source_table in ('call_category_contacts','on_call_contacts')),
  order_index integer not null default 1,
  applies_dates date[] not null default '{}',
  split_group text,
  split_note text,
  requires_approval_from text,
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- השם והטלפון נשמרים כעותק ולא כהפניה חיה: עריכה במדריך באמצע החג לא תשנה
-- לוח שכבר אושר, והשורה נותרת תקינה גם אם איש הקשר המקורי נמחק.
comment on column public.holiday_duty_entries.contact_name is 'עותק. לא הפניה חיה.';
comment on column public.holiday_duty_entries.applies_dates is
  'אילו ימים מתוך החג. מערך ריק = כל ימי החג.';

create index holiday_duty_entries_topic on public.holiday_duty_entries (topic_id, order_index);

alter table public.holiday_periods enable row level security;
alter table public.holiday_duty_topics enable row level security;
alter table public.holiday_duty_entries enable row level security;
-- אפס policies בכוונה: גישה דרך service role בלבד, כמו daily_reports.
```

- [ ] **Step 2: הרץ את בודק המיגרציות**

```bash
npm run db:lint-migrations
```

צפוי: `✅ תיקיית המיגרציות תקינה.`

- [ ] **Step 3: החל את המיגרציה**

```bash
npx supabase db push
```

- [ ] **Step 4: כתוב את סקריפט הזריעה**

```javascript
// scripts/seed-holidays.js
/**
 * זריעה חד-פעמית של תקופות חג ל-holiday_periods.
 * הרצה: node scripts/seed-holidays.js 5787 5788
 *
 * למה לזרוע ולא לקרוא ל-Hebcal בזמן אמת: המוקד עובד גם כשאין אינטרנט החוצה,
 * וזיהוי החג מכריע מי מוצג למוקדן. תאריכי חג אינם משתנים.
 */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const file = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0 && !line.trim().startsWith('#')) {
      const k = line.slice(0, i).trim();
      if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
    }
  }
}

async function main() {
  loadEnv();
  const years = process.argv.slice(2).length ? process.argv.slice(2) : ['5787', '5788'];
  const municipalityId = process.env.NEXT_PUBLIC_MUNICIPALITY_ID;
  if (!municipalityId) throw new Error('NEXT_PUBLIC_MUNICIPALITY_ID is not set');

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { buildPeriodsFromHebcal } = await import('../lib/holidays.js');

  for (const year of years) {
    const url =
      `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=off&mod=off&nx=off` +
      `&year=${year}&yt=H&c=on&geonameid=293397&M=on&s=off&i=on`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Hebcal ${year} returned ${res.status}`);
    const { items } = await res.json();

    const rows = buildPeriodsFromHebcal(items).map((p) => ({
      municipality_id: municipalityId,
      name: p.name,
      slug: `${p.days[0]}-${p.name}`.replace(/\s+/g, '-'),
      starts_at: p.starts_at,
      ends_at: p.ends_at,
    }));

    const { error } = await supabase
      .from('holiday_periods')
      .upsert(rows, { onConflict: 'municipality_id,slug', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    console.log(`${year}: נזרעו ${rows.length} תקופות`);
    for (const r of rows) console.log(`  ${r.name}  ${r.starts_at} → ${r.ends_at}`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
```

- [ ] **Step 5: הרץ את הזריעה וודא שראש השנה נכון**

```bash
node scripts/seed-holidays.js 5787 5788
```

צפוי: `ראש השנה 5787  2026-09-11T18:32:00+03:00 → 2026-09-13T19:26:00+03:00`

- [ ] **Step 6: כתוב את שכבת ה-DB**

```javascript
// lib/holiday-duty-db.js
import { supabase } from '@/lib/supabase-server';
import { findActivePeriod } from '@/lib/holidays';

/**
 * מטמון קצר בזיכרון. מנוע הזמינות שואל "האם עכשיו חג" בכל טעינה של מדריך
 * הכוננויות, ותאריכי חג אינם משתנים — אין סיבה לפגוע ב-DB בכל בקשה.
 */
const CACHE_TTL_MS = 60 * 1000;
const cache = new Map();

export async function loadPeriods(municipalityId) {
  const hit = cache.get(municipalityId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.periods;

  const { data, error } = await supabase
    .from('holiday_periods')
    .select('id, name, slug, starts_at, ends_at, status, notes')
    .eq('municipality_id', municipalityId)
    .order('starts_at');
  if (error) throw new Error(error.message);

  const periods = data || [];
  cache.set(municipalityId, { at: Date.now(), periods });
  return periods;
}

export async function getActivePeriod(municipalityId, now = new Date()) {
  return findActivePeriod(await loadPeriods(municipalityId), now);
}

/** לבדיקות ולזריעה מחדש. */
export function clearHolidayCache() {
  cache.clear();
}
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260910120000_holiday_duty.sql scripts/seed-holidays.js lib/holiday-duty-db.js
git commit -m "feat: טבלאות כוננות חג + זריעת חגי תשפז מ-Hebcal"
```

---

## Task 3: API הלוח

**Files:**
- Create: `app/api/holiday-duty/route.js`, `app/api/holiday-duty/periods/route.js`, `app/api/holiday-duty/contacts/route.js`
- Create: `app/api/holiday-duty/topics/route.js`, `app/api/holiday-duty/topics/[id]/route.js`
- Create: `app/api/holiday-duty/entries/route.js`, `app/api/holiday-duty/entries/[id]/route.js`
- Create: `app/api/holiday-duty/periods/[id]/seed/route.js`
- Test: `tests/holiday-duty-api.test.js`

**Interfaces:**
- Consumes: `loadPeriods`, `getActivePeriod` מ-Task 2; `supabase` מ-`@/lib/supabase-server`; `requireRole` מ-`@/lib/auth`.
- Produces: צורת התשובה של `GET /api/holiday-duty`, שעליה נשענות משימות 4–6:

```javascript
{
  success: true,
  period: { id, name, starts_at, ends_at, status, notes } | null,
  isActive: boolean,       // אנחנו בתוך החג עכשיו
  topics: [{
    id, name, display_order, status, confirmed_by_name, confirmed_at, instructions,
    entries: [{
      id, subtopic, contact_name, contact_phone, contact_role,
      order_index, applies_dates, split_group, split_note,
      requires_approval_from, note
    }]
  }]
}
```

- [ ] **Step 1: כתוב את הבדיקות הנכשלות**

```javascript
// tests/holiday-duty-api.test.js
import { describe, it, expect, vi } from 'vitest';
import { makeRequest } from './helpers/request';
import { createChainable } from './helpers/supabase-mock';
import { signToken } from '@/lib/auth';

vi.mock('@supabase/supabase-js', () => ({ createClient: () => createChainable() }));

const managerCookie = { 'auth-token': signToken({ id: 'u1', role: 'call_center_manager' }) };
const operatorCookie = { 'auth-token': signToken({ id: 'u2', role: 'operator' }) };

describe('GET /api/holiday-duty', () => {
  it('דוחה בקשה בלי טוקן', async () => {
    const { GET } = await import('@/app/api/holiday-duty/route');
    const res = await GET(makeRequest('/api/holiday-duty?municipality_id=yehud'));
    expect(res.status).toBe(401);
  });

  it('מוקדן רשאי לקרוא את הלוח', async () => {
    const { GET } = await import('@/app/api/holiday-duty/route');
    const res = await GET(
      makeRequest('/api/holiday-duty?municipality_id=yehud', { cookies: operatorCookie })
    );
    expect(res.status).toBe(200);
  });
});

describe('POST /api/holiday-duty/entries', () => {
  it('דוחה מוקדן — עריכה שמורה למנהל המוקד', async () => {
    const { POST } = await import('@/app/api/holiday-duty/entries/route');
    const res = await POST(
      makeRequest('/api/holiday-duty/entries', {
        method: 'POST',
        cookies: operatorCookie,
        body: { topic_id: 't1', contact_name: 'דוד דרזי' },
      })
    );
    expect(res.status).toBe(403);
  });

  it('מקבל מנהל מוקד', async () => {
    const { POST } = await import('@/app/api/holiday-duty/entries/route');
    const res = await POST(
      makeRequest('/api/holiday-duty/entries', {
        method: 'POST',
        cookies: managerCookie,
        body: { topic_id: 't1', municipality_id: 'yehud', contact_name: 'דוד דרזי' },
      })
    );
    expect(res.status).toBeLessThan(400);
  });

  it('דוחה שורה בלי שם איש קשר', async () => {
    const { POST } = await import('@/app/api/holiday-duty/entries/route');
    const res = await POST(
      makeRequest('/api/holiday-duty/entries', {
        method: 'POST',
        cookies: managerCookie,
        body: { topic_id: 't1', municipality_id: 'yehud' },
      })
    );
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: הרץ וודא כישלון**

```bash
npx vitest run tests/holiday-duty-api.test.js
```

צפוי: כישלון על ייבוא ראוטים שאינם קיימים.

- [ ] **Step 3: כתוב את ראוט הקריאה**

```javascript
// app/api/holiday-duty/route.js
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { requireRole } from '@/lib/auth';
import { loadPeriods } from '@/lib/holiday-duty-db';
import { findActivePeriod, findUpcomingPeriod } from '@/lib/holidays';

const READERS = [
  'operator', 'shift_supervisor', 'call_center_manager',
  'sector_manager', 'ceo', 'inspector', 'shelter_manager', 'admin',
];

export async function GET(request) {
  const auth = await requireRole(request, READERS);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const municipalityId = searchParams.get('municipality_id');
  const requested = searchParams.get('period'); // 'active' | 'upcoming' | uuid
  if (!municipalityId) {
    return NextResponse.json({ success: false, error: 'municipality_id חסר' }, { status: 400 });
  }

  const now = new Date();
  const periods = await loadPeriods(municipalityId);
  const active = findActivePeriod(periods, now);

  let period = null;
  if (!requested || requested === 'active') {
    // ברירת המחדל היא מה שהמוקדן צריך עכשיו: החג הנוכחי, ואם אין - הקרוב.
    period = active || findUpcomingPeriod(periods, now, 24 * 14);
  } else if (requested === 'upcoming') {
    period = findUpcomingPeriod(periods, now, 24 * 14);
  } else {
    period = periods.find((p) => p.id === requested) || null;
  }

  if (!period) {
    return NextResponse.json({ success: true, period: null, isActive: false, topics: [] });
  }

  const { data: topics, error } = await supabase
    .from('holiday_duty_topics')
    .select(
      'id, name, display_order, status, confirmed_by_name, confirmed_at, instructions,' +
        ' holiday_duty_entries(id, subtopic, contact_name, contact_phone, contact_role,' +
        ' order_index, applies_dates, split_group, split_note, requires_approval_from, note, active)'
    )
    .eq('holiday_period_id', period.id)
    .eq('active', true)
    .order('display_order');

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const shaped = (topics || []).map((t) => ({
    ...t,
    entries: (t.holiday_duty_entries || [])
      .filter((e) => e.active)
      .sort((a, b) => a.order_index - b.order_index),
    holiday_duty_entries: undefined,
  }));

  return NextResponse.json({
    success: true,
    period,
    isActive: active?.id === period.id,
    topics: shaped,
  });
}
```

- [ ] **Step 4: כתוב את ראוטי העריכה**

`topics/route.js` ו-`entries/route.js` זהים במבנה. זהו `entries/route.js` במלואו; `topics/route.js` נבנה באותה תבנית עם השדות `name, display_order, instructions, call_category_id` ובדיקת חובה על `name`:

```javascript
// app/api/holiday-duty/entries/route.js
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { requireRole } from '@/lib/auth';

const EDITORS = ['call_center_manager', 'admin'];

const FIELDS = [
  'subtopic', 'contact_name', 'contact_phone', 'contact_role',
  'source_contact_id', 'source_table', 'order_index', 'applies_dates',
  'split_group', 'split_note', 'requires_approval_from', 'note',
];

export async function POST(request) {
  const auth = await requireRole(request, EDITORS);
  if (auth.error) return auth.error;

  const body = await request.json();
  if (!body.topic_id || !body.municipality_id) {
    return NextResponse.json(
      { success: false, error: 'topic_id ו-municipality_id חובה' },
      { status: 400 }
    );
  }
  if (!body.contact_name?.trim()) {
    return NextResponse.json({ success: false, error: 'שם איש קשר חובה' }, { status: 400 });
  }

  const row = { topic_id: body.topic_id, municipality_id: body.municipality_id };
  for (const f of FIELDS) if (body[f] !== undefined) row[f] = body[f];

  const { data, error } = await supabase
    .from('holiday_duty_entries')
    .insert(row)
    .select()
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, entry: data });
}
```

```javascript
// app/api/holiday-duty/entries/[id]/route.js
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { requireRole } from '@/lib/auth';

const EDITORS = ['call_center_manager', 'admin'];
const FIELDS = [
  'subtopic', 'contact_name', 'contact_phone', 'contact_role',
  'order_index', 'applies_dates', 'split_group', 'split_note',
  'requires_approval_from', 'note', 'active',
];

export async function PATCH(request, { params }) {
  const auth = await requireRole(request, EDITORS);
  if (auth.error) return auth.error;

  const body = await request.json();
  const patch = { updated_at: new Date().toISOString() };
  for (const f of FIELDS) if (body[f] !== undefined) patch[f] = body[f];

  const { data, error } = await supabase
    .from('holiday_duty_entries')
    .update(patch)
    .eq('id', params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, entry: data });
}

export async function DELETE(request, { params }) {
  const auth = await requireRole(request, EDITORS);
  if (auth.error) return auth.error;

  const { error } = await supabase.from('holiday_duty_entries').delete().eq('id', params.id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 5: כתוב את בורר אנשי הקשר**

```javascript
// app/api/holiday-duty/contacts/route.js
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { requireRole } from '@/lib/auth';

const EDITORS = ['call_center_manager', 'admin'];

/**
 * מאחד אנשי קשר משתי הטבלאות.
 *
 * למה שתיהן: המדריך שומר אנשי קשר בשדות external_* של call_category_contacts,
 * אך יש אנשי קשר שקיימים רק ב-on_call_contacts ואינם משויכים לאף קטגוריה —
 * דוד דרזי הוא דוגמה קיימת. קריאה מטבלה אחת בלבד הייתה מסתירה אותם מהבורר.
 */
export async function GET(request) {
  const auth = await requireRole(request, EDITORS);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const municipalityId = searchParams.get('municipality_id');
  if (!municipalityId) {
    return NextResponse.json({ success: false, error: 'municipality_id חסר' }, { status: 400 });
  }

  const [guide, onCall] = await Promise.all([
    supabase
      .from('call_category_contacts')
      .select('id, external_name, external_phone, external_role, active, call_categories!inner(name, municipality_id)')
      .eq('active', true)
      .eq('call_categories.municipality_id', municipalityId),
    supabase
      .from('on_call_contacts')
      .select('id, name, phone, role_description, active')
      .eq('active', true)
      .eq('municipality_id', municipalityId),
  ]);

  const rows = [];
  for (const c of guide.data || []) {
    if (!c.external_name?.trim()) continue;
    rows.push({
      source_table: 'call_category_contacts',
      source_contact_id: c.id,
      name: c.external_name.trim(),
      phone: c.external_phone || null,
      role: c.external_role || null,
      from: c.call_categories?.name || null,
    });
  }
  for (const c of onCall.data || []) {
    if (!c.name?.trim()) continue;
    rows.push({
      source_table: 'on_call_contacts',
      source_contact_id: c.id,
      name: c.name.trim(),
      phone: c.phone || null,
      role: c.role_description || null,
      from: 'אנשי קשר כלליים',
    });
  }

  // ניכוי כפילויות לפי שם+טלפון. אותו אדם מופיע בכמה קטגוריות במדריך.
  const seen = new Map();
  for (const r of rows) {
    const key = `${r.name}|${r.phone || ''}`;
    if (!seen.has(key)) seen.set(key, r);
  }

  const contacts = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'he'));
  return NextResponse.json({ success: true, contacts });
}
```

- [ ] **Step 6: כתוב את ראוט הזריעה מהמדריך**

```javascript
// app/api/holiday-duty/periods/[id]/seed/route.js
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { requireRole } from '@/lib/auth';

const EDITORS = ['call_center_manager', 'admin'];

/**
 * ממלא לוח חג ריק בטיוטה.
 *
 * body: { municipality_id, from_period_id? }
 * עם from_period_id — משכפל לוח חג קודם. בלעדיו — מעתיק את הקטגוריות הפעילות
 * מהמדריך. כך מנהל המוקד מדייק דלתאות ולא מתחיל מדף ריק.
 */
export async function POST(request, { params }) {
  const auth = await requireRole(request, EDITORS);
  if (auth.error) return auth.error;

  const { municipality_id: municipalityId, from_period_id: fromPeriodId } = await request.json();
  if (!municipalityId) {
    return NextResponse.json({ success: false, error: 'municipality_id חסר' }, { status: 400 });
  }

  const { count } = await supabase
    .from('holiday_duty_topics')
    .select('id', { count: 'exact', head: true })
    .eq('holiday_period_id', params.id);
  if (count > 0) {
    return NextResponse.json(
      { success: false, error: 'ללוח כבר יש תוכן. יש למחוק אותו לפני זריעה מחדש.' },
      { status: 409 }
    );
  }

  const topics = fromPeriodId
    ? await topicsFromPeriod(fromPeriodId)
    : await topicsFromGuide(municipalityId);

  for (const t of topics) {
    const { data: topic, error } = await supabase
      .from('holiday_duty_topics')
      .insert({
        municipality_id: municipalityId,
        holiday_period_id: params.id,
        call_category_id: t.call_category_id || null,
        name: t.name,
        display_order: t.display_order,
        instructions: t.instructions || null,
      })
      .select('id')
      .single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    if (t.entries.length) {
      const { error: e2 } = await supabase.from('holiday_duty_entries').insert(
        t.entries.map((e) => ({ ...e, municipality_id: municipalityId, topic_id: topic.id }))
      );
      if (e2) return NextResponse.json({ success: false, error: e2.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, seeded: topics.length });
}

async function topicsFromGuide(municipalityId) {
  const { data } = await supabase
    .from('call_categories')
    .select(
      'id, name, display_order, instructions,' +
        ' call_category_contacts(external_name, external_phone, external_role, escalation_order, note, active)'
    )
    .eq('municipality_id', municipalityId)
    .eq('active', true)
    .order('display_order');

  return (data || []).map((c) => ({
    call_category_id: c.id,
    name: c.name,
    display_order: c.display_order || 0,
    instructions: c.instructions,
    entries: (c.call_category_contacts || [])
      .filter((x) => x.active && x.external_name?.trim())
      .map((x) => ({
        contact_name: x.external_name.trim(),
        contact_phone: x.external_phone || null,
        contact_role: x.external_role || null,
        order_index: x.escalation_order || 1,
        note: x.note || null,
      })),
  }));
}

async function topicsFromPeriod(periodId) {
  const { data } = await supabase
    .from('holiday_duty_topics')
    .select(
      'call_category_id, name, display_order, instructions,' +
        ' holiday_duty_entries(subtopic, contact_name, contact_phone, contact_role,' +
        ' order_index, split_group, split_note, requires_approval_from, note, active)'
    )
    .eq('holiday_period_id', periodId)
    .eq('active', true)
    .order('display_order');

  return (data || []).map((t) => ({
    call_category_id: t.call_category_id,
    name: t.name,
    display_order: t.display_order,
    instructions: t.instructions,
    // applies_dates לא משוכפל בכוונה: התאריכים שייכים לחג הקודם.
    entries: (t.holiday_duty_entries || [])
      .filter((e) => e.active)
      .map(({ active, ...e }) => e),
  }));
}
```

- [ ] **Step 7: כתוב את `app/api/holiday-duty/periods/route.js`**

```javascript
// app/api/holiday-duty/periods/route.js
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { loadPeriods } from '@/lib/holiday-duty-db';

const EDITORS = ['call_center_manager', 'admin'];

export async function GET(request) {
  const auth = await requireRole(request, EDITORS);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const municipalityId = searchParams.get('municipality_id');
  if (!municipalityId) {
    return NextResponse.json({ success: false, error: 'municipality_id חסר' }, { status: 400 });
  }
  const periods = await loadPeriods(municipalityId);
  const now = Date.now();
  return NextResponse.json({
    success: true,
    periods: periods.filter((p) => new Date(p.ends_at).getTime() >= now - 30 * 24 * 3600 * 1000),
  });
}
```

- [ ] **Step 8: הרץ את הבדיקות**

```bash
npx vitest run tests/holiday-duty-api.test.js tests/api-auth-contract.test.js
```

צפוי: הכול עובר, כולל חוזה האבטחה שסורק את הראוטים החדשים.

- [ ] **Step 9: Commit**

```bash
git add app/api/holiday-duty tests/holiday-duty-api.test.js
git commit -m "feat: API כוננות חג - קריאה, עריכה, בורר אנשי קשר וזריעה מהמדריך"
```

---

## Task 4: מסך המוקדן

**Files:**
- Create: `components/HolidayDutyBoard.js`, `app/holiday-duty/page.js`
- Modify: `middleware.js`

**Interfaces:**
- Consumes: `GET /api/holiday-duty` מ-Task 3.
- Produces: `<HolidayDutyBoard period topics isActive compact />` — רכיב תצוגה טהור, ללא שליפה משלו. Task 8 משתמש בו למסך הקיר.

- [ ] **Step 1: רשום את הדף ב-middleware**

ב-`middleware.js`, ל-`ROUTE_PERMISSIONS` הוסף אחרי השורה של `/on-call-query`:

```javascript
  // לוח כוננות החג. קריאה בלבד לכל תפקידי המוקד; העריכה יושבת תחת
  // /call-center-manager ומוגנת שם.
  '/holiday-duty': ['ceo', 'call_center_manager', 'shift_supervisor', 'sector_manager', 'operator', 'inspector', 'shelter_manager', 'admin'],
```

ול-`config.matcher` הוסף:

```javascript
    '/holiday-duty',
```

- [ ] **Step 2: הרץ את בדיקת שערי הדפים וודא שהיא נכשלת בלי הדף**

```bash
npx vitest run tests/page-gates.test.js
```

צפוי: עוברת. אם תיצור את הדף לפני הרישום היא תיכשל — זו בדיוק מטרתה.

- [ ] **Step 3: כתוב את רכיב התצוגה**

```javascript
// components/HolidayDutyBoard.js
'use client';

import { useMemo, useState } from 'react';

/**
 * תצוגת לוח החג. רכיב טהור — לא שולף בעצמו, כדי שגם דף המוקדן וגם מסך הקיר
 * יציגו בדיוק את אותו דבר ולא יסטו זה מזה עם הזמן.
 */
export default function HolidayDutyBoard({ period, topics = [], isActive = false, compact = false }) {
  const [search, setSearch] = useState('');

  const todayIso = useMemo(
    () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }),
    []
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return topics;
    const term = search.trim().toLowerCase();
    return topics
      .map((t) => ({
        ...t,
        entries: t.entries.filter(
          (e) =>
            e.contact_name.toLowerCase().includes(term) ||
            (e.subtopic || '').toLowerCase().includes(term) ||
            (e.note || '').toLowerCase().includes(term)
        ),
      }))
      .filter((t) => t.name.toLowerCase().includes(term) || t.entries.length > 0);
  }, [search, topics]);

  if (!period) {
    return (
      <div className="p-6 text-center text-gray-500" dir="rtl">
        אין חג מוגדר כרגע.
      </div>
    );
  }

  /** שורה ריקה ב-applies_dates חלה על כל ימי החג. */
  const appliesToday = (entry) =>
    !entry.applies_dates?.length || entry.applies_dates.includes(todayIso);

  return (
    <div dir="rtl" className="space-y-3">
      <div className={`rounded-2xl px-4 py-3 ${isActive ? 'bg-amber-600' : 'bg-slate-800'}`}>
        <div className="text-white font-bold text-lg">
          {isActive ? '🕯️ מצב חג פעיל' : '🕯️ לוח כוננות חג'} — {period.name}
        </div>
        <div className="text-white/80 text-sm">
          כניסה {fmt(period.starts_at)} · יציאה {fmt(period.ends_at)}
        </div>
        {period.notes && <div className="text-white/90 text-sm mt-1">{period.notes}</div>}
      </div>

      {!compact && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש נושא, שם או הערה..."
          className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-right"
        />
      )}

      {filtered.map((topic) => (
        <div key={topic.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="bg-slate-100 px-4 py-2 flex items-center justify-between">
            <span className="font-bold text-gray-900">{topic.name}</span>
            {topic.status === 'pending' && (
              <span className="text-xs text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                טרם עודכן מהמחלקה
              </span>
            )}
          </div>
          {topic.instructions && (
            <div className="px-4 py-2 text-sm text-gray-600 bg-gray-50">{topic.instructions}</div>
          )}
          <div className="divide-y divide-gray-100">
            {topic.entries.map((e) => (
              <div
                key={e.id}
                className={`px-4 py-2.5 ${appliesToday(e) ? '' : 'opacity-40'}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400">{e.order_index}</span>
                  {e.subtopic && (
                    <span className="text-xs bg-slate-200 text-slate-700 rounded px-1.5 py-0.5">
                      {e.subtopic}
                    </span>
                  )}
                  <span className="font-semibold text-gray-900">{e.contact_name}</span>
                  {e.contact_role && <span className="text-xs text-gray-500">{e.contact_role}</span>}
                  {e.contact_phone ? (
                    <a
                      href={`tel:${e.contact_phone}`}
                      className="mr-auto text-blue-600 font-mono text-sm"
                    >
                      {e.contact_phone}
                    </a>
                  ) : (
                    <span className="mr-auto text-xs text-red-600">אין טלפון</span>
                  )}
                </div>
                {e.split_note && (
                  <div className="text-xs text-purple-700 mt-1">⚖️ {e.split_note}</div>
                )}
                {e.requires_approval_from && (
                  <div className="text-xs text-red-700 mt-1">
                    🔒 רק באישור {e.requires_approval_from}
                  </div>
                )}
                {e.note && <div className="text-xs text-gray-600 mt-1">{e.note}</div>}
                {!appliesToday(e) && (
                  <div className="text-xs text-gray-400 mt-1">
                    לא רלוונטי היום · {e.applies_dates.join(', ')}
                  </div>
                )}
              </div>
            ))}
            {topic.entries.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-400">אין כוננים מוגדרים</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function fmt(iso) {
  return new Date(iso).toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
```

- [ ] **Step 4: כתוב את הדף**

```javascript
// app/holiday-duty/page.js
'use client';

import { useEffect, useState } from 'react';
import { getMunicipalityId } from '@/lib/municipality';
import HolidayDutyBoard from '@/components/HolidayDutyBoard';

export default function HolidayDutyPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/holiday-duty?municipality_id=${getMunicipalityId()}`);
        const json = await res.json();
        if (!alive) return;
        if (json.success) setData(json);
        else setError(json.error || 'שגיאה בטעינת הלוח');
      } catch {
        if (alive) setError('שגיאה בטעינת הלוח');
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const timer = setInterval(load, 5 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" dir="rtl">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-slate-700" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-red-600" dir="rtl">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4" dir="rtl">
      <HolidayDutyBoard period={data.period} topics={data.topics} isActive={data.isActive} />
    </div>
  );
}
```

- [ ] **Step 5: הרץ את הבדיקות**

```bash
npm test
```

צפוי: `page-gates` עוברת עם הדף החדש.

- [ ] **Step 6: Commit**

```bash
git add app/holiday-duty components/HolidayDutyBoard.js middleware.js
git commit -m "feat: מסך כוננות חג למוקדן"
```

---

## Task 5: לשונית העריכה למנהל המוקד

**Files:**
- Create: `components/HolidayDutyManager.js`
- Modify: `app/call-center-manager/page.js`

**Interfaces:**
- Consumes: כל ראוטי Task 3.
- Produces: `<HolidayDutyManager />` — עצמאי, שולף בעצמו.

**התנהגות נדרשת:** בורר חג למעלה; כפתור "מלא מהמדריך" ו"שכפל מחג קודם" כשהלוח ריק; לכל נושא — שם, כפתור "עודכן טלפונית" עם שם המוסר, והוספת שורה; לכל שורה — תת-נושא, בחירת איש קשר מרשימה או הזנה ידנית, סדר, ימים בתוך החג, הערה, תנאי אישור, הערת חלוקה; מחיקה; הוספת נושא חדש.

- [ ] **Step 1: כתוב את שלד הרכיב עם הטעינה**

```javascript
// components/HolidayDutyManager.js
'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getMunicipalityId } from '@/lib/municipality';

export default function HolidayDutyManager() {
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState('');
  const [board, setBoard] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const mid = getMunicipalityId();

  const loadBoard = useCallback(
    async (id) => {
      const res = await fetch(`/api/holiday-duty?municipality_id=${mid}&period=${id || 'active'}`);
      const json = await res.json();
      if (json.success) {
        setBoard(json);
        if (!id && json.period) setPeriodId(json.period.id);
      } else toast.error(json.error || 'שגיאה בטעינת הלוח');
    },
    [mid]
  );

  useEffect(() => {
    (async () => {
      const [p, c] = await Promise.all([
        fetch(`/api/holiday-duty/periods?municipality_id=${mid}`).then((r) => r.json()),
        fetch(`/api/holiday-duty/contacts?municipality_id=${mid}`).then((r) => r.json()),
      ]);
      if (p.success) setPeriods(p.periods);
      if (c.success) setContacts(c.contacts);
      await loadBoard('');
      setLoading(false);
    })();
  }, [mid, loadBoard]);

  // ... שאר הרכיב בשלבים הבאים
}
```

- [ ] **Step 2: הוסף את פעולות השמירה**

```javascript
  const seedFromGuide = async (fromPeriodId) => {
    const res = await fetch(`/api/holiday-duty/periods/${periodId}/seed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ municipality_id: mid, from_period_id: fromPeriodId || undefined }),
    });
    const json = await res.json();
    if (json.success) {
      toast.success(`נוצרו ${json.seeded} נושאים`);
      await loadBoard(periodId);
    } else toast.error(json.error);
  };

  const addTopic = async (name) => {
    const res = await fetch('/api/holiday-duty/topics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        municipality_id: mid,
        holiday_period_id: periodId,
        name,
        display_order: (board?.topics?.length || 0) + 1,
      }),
    });
    const json = await res.json();
    if (json.success) await loadBoard(periodId);
    else toast.error(json.error);
  };

  const confirmTopic = async (topicId, byName) => {
    await patch(`/api/holiday-duty/topics/${topicId}`, {
      status: 'confirmed',
      confirmed_by_name: byName,
      confirmed_at: new Date().toISOString(),
    });
  };

  const saveEntry = async (topicId, entry) => {
    const url = entry.id
      ? `/api/holiday-duty/entries/${entry.id}`
      : '/api/holiday-duty/entries';
    const res = await fetch(url, {
      method: entry.id ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...entry, municipality_id: mid, topic_id: topicId }),
    });
    const json = await res.json();
    if (json.success) await loadBoard(periodId);
    else toast.error(json.error);
  };

  const deleteEntry = async (entryId) => {
    await fetch(`/api/holiday-duty/entries/${entryId}`, { method: 'DELETE' });
    await loadBoard(periodId);
  };

  async function patch(url, body) {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json.success) await loadBoard(periodId);
    else toast.error(json.error);
  }
```

- [ ] **Step 3: בנה את ה-UI**

מבנה נדרש, בסגנון הרכיבים הקיימים ב-`components/` (Tailwind, `dir="rtl"`, כרטיסים מעוגלים):

1. בורר חג — `<select>` על `periods`, מציג שם ותאריכים. שינוי קורא ל-`loadBoard(id)`.
2. כשאין נושאים — שני כפתורים: "מלא מהמדריך" (`seedFromGuide()`) ו"שכפל מחג קודם" עם בורר חג מקור (`seedFromGuide(srcId)`).
3. לכל נושא — כותרת, תג סטטוס, שדה "עודכן ע״י" + כפתור אישור, כפתור "הוסף שורה".
4. שורה בעריכה — בורר איש קשר מ-`contacts` (מציג `name · phone · from`) שממלא `contact_name`, `contact_phone`, `contact_role`, `source_contact_id`, `source_table`; מתג "הזנה ידנית" שחושף שדות שם וטלפון; `subtopic`; `order_index`; בורר ימים מ-`board.period` (רשימת התאריכים בין `starts_at` ל-`ends_at`) שמזין `applies_dates`; `split_note`; `requires_approval_from`; `note`.
5. כפתור "הוסף נושא" בתחתית.

```javascript
/** ימי החג לבחירה ב-applies_dates. */
function holidayDates(period) {
  if (!period) return [];
  const out = [];
  const end = new Date(period.ends_at);
  const cur = new Date(period.starts_at);
  while (cur <= end) {
    out.push(cur.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }));
    cur.setDate(cur.getDate() + 1);
  }
  return [...new Set(out)];
}
```

- [ ] **Step 4: חבר את הלשונית**

ב-`app/call-center-manager/page.js`:

```javascript
import HolidayDutyManager from '@/components/HolidayDutyManager';
```

הוסף כפתור לשונית באותה תבנית של `call-categories` (סביבות שורה 626):

```javascript
              <button
                onClick={() => setActiveTab('holiday-duty')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'holiday-duty'
                    ? 'bg-slate-800 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🕯️ כוננות חג
              </button>
```

ואת גוף הלשונית ליד שאר הבלוקים:

```javascript
        {activeTab === 'holiday-duty' && <HolidayDutyManager />}
```

- [ ] **Step 5: הרץ בדיקות ובנייה**

```bash
npm test && npm run lint
```

- [ ] **Step 6: אמת בדפדפן**

הפעל את שרת הפיתוח, היכנס כמנהל מוקד, פתח את הלשונית, לחץ "מלא מהמדריך", ערוך שורה, ורענן את `/holiday-duty` בלשונית אחרת כדי לוודא שהשינוי נשמר.

- [ ] **Step 7: Commit**

```bash
git add components/HolidayDutyManager.js app/call-center-manager/page.js
git commit -m "feat: לשונית עריכת כוננות חג למנהל המוקד"
```

---

## Task 6: באנר החג

**Files:**
- Create: `components/HolidayBanner.js`
- Modify: `app/operator/page.js`

**Interfaces:**
- Consumes: `GET /api/holiday-duty` מ-Task 3.
- Produces: `<HolidayBanner />` — לא מרנדר כלום כשאין חג פעיל או קרוב.

- [ ] **Step 1: כתוב את הרכיב**

```javascript
// components/HolidayBanner.js
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMunicipalityId } from '@/lib/municipality';

/**
 * מופיע רק כשיש חג פעיל, או חג שמתחיל בתוך 48 שעות. שאר הזמן אינו מרנדר
 * כלום — באנר שתמיד שם מפסיק להיקרא.
 */
export default function HolidayBanner() {
  const [state, setState] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/holiday-duty?municipality_id=${getMunicipalityId()}`);
        const json = await res.json();
        if (!alive || !json.success || !json.period) return;

        const startsIn = new Date(json.period.starts_at).getTime() - Date.now();
        if (json.isActive || (startsIn > 0 && startsIn <= 48 * 3600 * 1000)) {
          setState({ period: json.period, isActive: json.isActive });
        }
      } catch {
        /* באנר אינו קריטי — כישלון שקט */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!state) return null;

  const { period, isActive } = state;
  return (
    <Link
      href="/holiday-duty"
      dir="rtl"
      className={`block rounded-xl px-4 py-3 mb-3 text-white ${
        isActive ? 'bg-amber-600' : 'bg-slate-700'
      }`}
    >
      <span className="font-bold">
        🕯️ {isActive ? 'מצב חג' : 'חג מתקרב'} — {period.name}
      </span>
      <span className="text-white/85 text-sm mr-2">
        {isActive
          ? `צאת החג ${fmt(period.ends_at)}`
          : `כניסת החג ${fmt(period.starts_at)}`}
      </span>
      <span className="text-white/70 text-sm mr-2">· לוח הכוננות ▸</span>
    </Link>
  );
}

function fmt(iso) {
  return new Date(iso).toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}
```

- [ ] **Step 2: הצב אותו בדף המוקדן**

ב-`app/operator/page.js`, ייבא והצב מעל התוכן הראשי, ליד `<ActiveEventBanner />` אם קיים:

```javascript
import HolidayBanner from '@/components/HolidayBanner';
// ...
        <HolidayBanner />
```

- [ ] **Step 3: הרץ בדיקות**

```bash
npm test && npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add components/HolidayBanner.js app/operator/page.js
git commit -m "feat: באנר חג בדף המוקדן"
```

**כאן מסתיים שלב 1. הלוח ניתן למילוי ולצפייה.**

---

## Task 7: תיקון זיהוי החג במנוע הזמינות

**Files:**
- Modify: `app/api/call-categories/route.js:49-160`
- Test: `tests/holiday-duty-api.test.js` (הוספה)

**Interfaces:**
- Consumes: `loadPeriods` מ-Task 2, `isHolidayNow` ו-`effectiveDayOfWeek` מ-Task 1.

- [ ] **Step 1: כתוב את הבדיקה הנכשלת**

הוסף ל-`tests/holiday-duty-api.test.js`:

```javascript
import { isHolidayNow, effectiveDayOfWeek } from '@/lib/holidays';

describe('מנוע הזמינות בחג', () => {
  const roshHashana = [
    {
      id: 'p1',
      name: 'ראש השנה 5787',
      starts_at: '2026-09-11T18:32:00+03:00',
      ends_at: '2026-09-13T19:26:00+03:00',
    },
  ];

  it('יום ראשון שהוא חג נבדק כשבת ולא כיום חול', () => {
    // הבאג: הכונן מוגדר [5,6] ולכן נעלם ביום ראשון, וצוות יום החול מוצג במקומו
    const sundayChag = new Date('2026-09-13T09:00:00+03:00');
    expect(effectiveDayOfWeek(roshHashana, sundayChag)).toBe(6);
    expect([5, 6].includes(effectiveDayOfWeek(roshHashana, sundayChag))).toBe(true);
  });

  it('שומר שבת אינו זמין בחג', () => {
    expect(isHolidayNow(roshHashana, new Date('2026-09-12T11:00:00+03:00'))).toBe(true);
  });

  it('יום ראשון רגיל אינו מושפע', () => {
    expect(effectiveDayOfWeek(roshHashana, new Date('2026-09-06T09:00:00+03:00'))).toBe(0);
  });
});
```

- [ ] **Step 2: הרץ וודא כישלון**

```bash
npx vitest run tests/holiday-duty-api.test.js
```

- [ ] **Step 3: תקן את הראוט**

ב-`app/api/call-categories/route.js`, אחרי טעינת `shabbatTimes` (סביבות שורה 67) הוסף:

```javascript
    // תקופות החג מה-DB. שאלת "האם עכשיו חג" חייבת להיות מקומית: המוקד עובד
    // גם כשאין אינטרנט החוצה, ו-hebcal/shabbat לבדו אינו מכיר חגים כלל.
    let holidayPeriods = [];
    if (currentTimeOnly) {
      try {
        holidayPeriods = await loadPeriods(municipalityId);
      } catch (e) {
        console.error('Failed to load holiday periods:', e);
      }
    }
    const onHoliday = isHolidayNow(holidayPeriods, new Date());
```

עם הייבוא בראש הקובץ:

```javascript
import { loadPeriods } from '@/lib/holiday-duty-db';
import { isHolidayNow, effectiveDayOfWeek } from '@/lib/holidays';
```

החלף את חישוב `currentDay` (שורה 96) ב:

```javascript
          // בחג יוחזר 6. "חגים זה כמו שישי שבת" — בלי זה, ביום ראשון שהוא חג
          // נבחר צוות יום החול והמוקדן נשלח לכונן הלא נכון.
          const currentDay = effectiveDayOfWeek(holidayPeriods, now);
```

והרחב את בדיקת שומרי השבת (שורה 147):

```javascript
            if (contact.shabbat_observer) {
              if (onHoliday) continue; // חג — כמו שבת
              if (shabbatTimes) {
                const { candleLighting, havdalah } = shabbatTimes;
                const shabbatStart = new Date(candleLighting.getTime() - 2 * 60 * 60 * 1000);
                const shabbatEnd = new Date(havdalah.getTime() + 2 * 60 * 60 * 1000);
                if (now >= shabbatStart && now <= shabbatEnd) continue;
              }
            }
```

> שים לב: השורה המקורית מסתיימת ב-`continue` בתוך תנאי `now >= shabbatStart && now <= shabbatEnd`. שמור על אותה סמנטיקה בדיוק ואל תשנה את שאר הלולאה.

- [ ] **Step 4: הרץ את הבדיקות**

```bash
npm test
```

- [ ] **Step 5: אמת ידנית מול התאריך האמיתי**

```bash
node -e "
const { buildPeriodsFromHebcal, effectiveDayOfWeek } = require('./lib/holidays.js');
" 2>/dev/null || npx vitest run tests/holidays.test.js
```

- [ ] **Step 6: Commit**

```bash
git add app/api/call-categories/route.js tests/holiday-duty-api.test.js
git commit -m "fix: מדריך הכוננויות מכיר חגים - יום ראשון שהוא חג מתנהג כשבת"
```

---

## Task 8: מסך הקיר וייצוא PDF

**Files:**
- Modify: `app/screen/page.js`
- Modify: `app/holiday-duty/page.js` (כפתור PDF)

**Interfaces:**
- Consumes: `<HolidayDutyBoard compact />` מ-Task 4; `GET /api/holiday-duty`.

- [ ] **Step 1: הוסף פאנל חג למסך הקיר**

ב-`app/screen/page.js`, שלוף את הלוח לצד שאר הנתונים והצג `<HolidayDutyBoard compact />` רק כאשר `isActive`. הראוט כבר מוגן ב-`requireRole`; מסך הקיר משתמש בטוקן מסך, ולכן החלף ב-`app/api/holiday-duty/route.js` את `requireRole` ב-`requireRoleOrScreen`:

```javascript
import { requireRoleOrScreen } from '@/lib/auth';
// ...
  const auth = await requireRoleOrScreen(request, READERS);
```

- [ ] **Step 2: הרץ את חוזה האבטחה**

```bash
npx vitest run tests/api-auth-contract.test.js
```

צפוי: עובר — `requireRoleOrScreen` עדיין מחזיר 401 בלי טוקן.

- [ ] **Step 3: הוסף כפתור PDF**

ב-`app/holiday-duty/page.js`, בעקבות `lib/daily-report-print.js`:

```javascript
  const downloadPdf = async () => {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);
    const node = document.getElementById('holiday-board');
    const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff' });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height);
    pdf.save(`כוננות-חג-${data.period.name}.pdf`);
  };
```

עטוף את ה-`<HolidayDutyBoard>` ב-`<div id="holiday-board">` והוסף כפתור הורדה.

- [ ] **Step 4: הרץ בדיקות ואמת בדפדפן**

```bash
npm test && npm run lint
```

הורד PDF ואמת שהעברית מוצגת נכון ושהלוח שלם.

- [ ] **Step 5: Commit**

```bash
git add app/screen/page.js app/holiday-duty/page.js app/api/holiday-duty/route.js
git commit -m "feat: לוח כוננות חג על מסך הקיר וייצוא PDF"
```

---

## Self-Review

**כיסוי מול האפיון:**

| דרישה באפיון | משימה |
|---|---|
| `holiday_periods`, `holiday_duty_topics`, `holiday_duty_entries` | 2 |
| זריעה מ-Hebcal ללא תלות בזמן ריצה | 2 |
| `lib/holidays.js` עם ארבע הפונקציות | 1 |
| תיקון `shabbat_observer` בחג | 7 |
| תיקון `available_days` ביום חג | 7 |
| כל ראוטי ה-API | 3 |
| בורר אנשי קשר משתי הטבלאות | 3 |
| זריעה מהמדריך ושכפול מחג קודם | 3 |
| `/holiday-duty` לקריאה | 4 |
| לשונית עריכה | 5 |
| באנר | 6 |
| מסך קיר | 8 |
| ייצוא PDF | 8 |
| בדיקות `lib/holidays.js` | 1 |
| בדיקת סינון שומר שבת בחג | 7 |

אין דרישה באפיון ללא משימה.

**עקביות טיפוסים:** `period` נושא `{ id, name, slug, starts_at, ends_at, status, notes }` בכל המשימות. `entry` נושא את אותם שדות ב-Task 3 (API), Task 4 (תצוגה) ו-Task 5 (עריכה). `applies_dates` הוא תמיד `string[]` בפורמט `YYYY-MM-DD`, ומערך ריק פירושו "כל ימי החג" — בעקביות בין ה-SQL, ה-API והתצוגה.

**סיכון ידוע:** Task 8 משנה את `requireRole` ל-`requireRoleOrScreen` בראוט שנוצר ב-Task 3. אם Task 8 לא יבוצע, הראוט נשאר תקין — מסך הקיר פשוט לא יציג את הפאנל.
