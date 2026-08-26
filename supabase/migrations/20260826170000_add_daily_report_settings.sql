-- YOA-42 שלב 2 (docs/16): כללי הסיווג של האירועים החריגים הם הגדרה,
-- לא קוד - שדה טקסט בעברית שמירי או יואב מעדכנים. גם המודל הגדרה.
create table public.daily_report_settings (
  municipality_id uuid primary key,
  classification_rules text not null,
  ai_model text not null default 'gpt-4o-mini',
  updated_at timestamptz not null default now()
);

alter table public.daily_report_settings enable row level security;
-- אפס policies בכוונה: גישה דרך service role בלבד, כמו daily_reports.
