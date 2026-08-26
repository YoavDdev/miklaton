-- YOA-42 שלב 3 (docs/16): עבודות בעיר - רשימה מנוהלת עם טווחי תאריכים.
-- כל עבודה נרשמת פעם אחת; הדוח מסנן לבד לפי חפיפה עם יום הדוח.
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
