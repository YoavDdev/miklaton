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
