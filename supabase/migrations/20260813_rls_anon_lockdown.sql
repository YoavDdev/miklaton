-- ================================================================
-- 20260813 — הקשחת RLS: נעילת ה-anon key מהדפדפן
--
-- רקע: עד עכשיו ה-RLS איפשר ל-anon key (שחשוף בדפדפן) לקרוא ולכתוב
-- לכל הטבלאות. כל פעולות הכתיבה הועברו ל-API (עם אימות), וה-API עבר
-- להשתמש ב-SUPABASE_SERVICE_ROLE_KEY (שעוקף RLS ולכן לא מושפע).
--
-- ⚠️ דרישות מוקדמות לפני הרצה:
--   1. הקוד מגרסה זו פרוס (routes עם service role) — אחרת ה-API ייחסם!
--   2. SUPABASE_SERVICE_ROLE_KEY מוגדר ב-Vercel וב-.env.local
--
-- להריץ ב-SQL Editor של Supabase. בטוח להרצה חוזרת (idempotent).
-- ================================================================

-- ── 1) טבלאות שהדפדפן קורא ישירות (query / realtime) — קריאה בלבד ──
-- realtime עם anon key מכבד RLS: מדיניות SELECT נדרשת כדי שמסך המוקד
-- והדפים האחרים ימשיכו לקבל עדכונים חיים.
do $$
declare
  t text;
  pol record;
begin
  foreach t in array array[
    'contacts',
    'departments',
    'duty_roster',
    'call_category_contacts',
    'general_notifications',
    'on_call_contacts',
    'security_daily_order_entries',
    'security_daily_orders',
    'war_mode'
  ] loop
    if to_regclass('public.' || t) is null then
      raise notice 'טבלה % לא קיימת - מדלגים', t;
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    execute format('create policy anon_read_only on public.%I for select using (true)', t);
  end loop;
end $$;

-- ── 2) user_profiles — קריאת עמודות בטוחות בלבד ──
-- דף האירועים קורא full_name מהדפדפן; ה-middleware עבר ל-service role.
-- הרשאות ברמת עמודה מסתירות טלפון ופרטים מנהלתיים מה-anon key.
do $$
declare pol record;
begin
  alter table public.user_profiles enable row level security;
  for pol in
    select policyname from pg_policies where schemaname = 'public' and tablename = 'user_profiles'
  loop
    execute format('drop policy %I on public.user_profiles', pol.policyname);
  end loop;
  create policy anon_read_only on public.user_profiles for select using (true);
end $$;

revoke select, insert, update, delete on public.user_profiles from anon, authenticated;
grant select (id, full_name, role, status) on public.user_profiles to anon, authenticated;

-- ── 3) טבלאות אירועים — נשארות פתוחות בכוונה (זמנית) ──
-- דף האורחים /event/live/[token] כותב אליהן ישירות עם ה-anon key.
-- ייסגרו בריפקטור ה-Events (העברת הכתיבות ל-API עם אימות טוקן אירוע).
do $$
declare
  t text;
  pol record;
begin
  foreach t in array array['emergency_events', 'event_journal', 'event_participants'] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    execute format(
      'create policy anon_full_temp on public.%I for all using (true) with check (true)', t
    );
  end loop;
end $$;

-- ── 4) כל שאר הטבלאות — חסומות לחלוטין ל-anon ──
-- RLS מופעל בלי אף מדיניות => אין גישה. רק ה-API (service role) ניגש.
do $$
declare
  t text;
  pol record;
begin
  foreach t in array array[
    'audit_log',
    'call_categories',
    'call_category_rules',
    'call_category_subcategories',
    'call_category_subcategory_contacts',
    'call_center_schedule',
    'call_center_shifts',
    'call_center_staff',
    'daily_updates',
    'garbage_collection_schedule',
    'knowledge_base',
    'knowledge_chat_history',
    'municipalities',
    'on_call_shifts',
    'operator_messages',
    'operator_sessions',
    'operator_shifts',
    'operator_tasks',
    'panic_buttons',
    'password_resets',
    'security_settings',
    'security_shift_changes',
    'security_shifts',
    'security_staff',
    'security_staff_leave',
    'security_weekly_schedule',
    'shelter_status',
    'shift_messages',
    'survey_responses',
    'surveys',
    'system_settings',
    'user_departments'
  ] loop
    if to_regclass('public.' || t) is null then
      raise notice 'טבלה % לא קיימת - מדלגים', t;
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
  end loop;
end $$;

-- ── אימות: מצב ה-RLS והמדיניות אחרי ההרצה ──
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  coalesce(p.cnt, 0) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join (
  select tablename, count(*) as cnt from pg_policies where schemaname = 'public' group by tablename
) p on p.tablename = c.relname
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;
