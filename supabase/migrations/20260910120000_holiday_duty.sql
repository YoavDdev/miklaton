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
