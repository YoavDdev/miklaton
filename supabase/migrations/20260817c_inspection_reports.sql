-- ============================================================
-- טבלת דוחות פיקוח (YOA-10)
-- מחליפה את data/inspectionReports.json — כתיבה לקובץ לא עובדת
-- ב-Vercel (מערכת קבצים זמנית, הדוחות היו נעלמים בכל deploy).
-- בטוח להריץ בכל שלב (טבלה חדשה, additive).
-- ============================================================

create table if not exists public.inspection_reports (
  id uuid primary key default gen_random_uuid(),
  inspector_name varchar(120) not null,
  zone varchar(20) not null,
  location_type varchar(50) not null,
  location_name varchar(200) not null,
  location_address varchar(300),
  description text not null,
  status varchar(20) not null default 'open' check (status in ('open', 'resolved')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_inspection_reports_zone on public.inspection_reports (zone);
create index if not exists idx_inspection_reports_status on public.inspection_reports (status);

-- נעילה מלאה ל-anon/authenticated — גישה דרך ה-API בלבד (service role)
alter table public.inspection_reports enable row level security;
