-- ============================================================
-- נעילת טבלאות האירועים + Storage (סוגר את הריפקטור - YOA-5)
-- להריץ בפרודקשן רק אחרי פריסת הקוד החדש!
-- הקוד החדש עובד כולו דרך service role; ה-anon key לא נזקק יותר
-- לטבלאות האלו (אין Realtime ואין כתיבות מהדפדפן).
-- ============================================================

do $$
declare
  t text;
  pol record;
begin
  foreach t in array array['emergency_events', 'event_journal', 'event_participants'] loop
    execute format('alter table public.%I enable row level security', t);
    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;
    -- אפס policies = נעילה מלאה ל-anon/authenticated (כמו שאר הטבלאות)
  end loop;
end $$;

-- Storage: ביטול ההעלאה הציבורית ל-bucket התמונות (העלאה רק דרך ה-API)
drop policy if exists "Allow upload event images" on storage.objects;
-- קריאה ציבורית של תמונות נשארת ("Public read event images")

-- Realtime: הדפים עברו ל-polling - אין צורך בפרסום הטבלאות
do $$
begin
  begin
    alter publication supabase_realtime drop table public.emergency_events;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime drop table public.event_journal;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime drop table public.event_participants;
  exception when others then null;
  end;
end $$;
