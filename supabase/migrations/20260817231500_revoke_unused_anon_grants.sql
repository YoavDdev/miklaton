-- ================================================================
-- YOA-18 + YOA-19 — צמצום חשיפת PII למפתח ה-anon הציבורי
--
-- רקע: 20260813_rls_anon_lockdown.sql נתנה הרשאת קריאה לאנונימי על תשע
-- טבלאות, בנימוק שהדפדפן קורא אותן ישירות או דרך realtime. הנימוק היה נכון
-- כשנכתב, אבל השתנה מאז.
--
-- מה שאומת מול הפרודקשן לפני המיגרציה הזו:
--
--   1. הפרסום supabase_realtime מכיל בדיוק ארבע טבלאות - contacts,
--      departments, duty_roster, war_mode. נקרא ישירות מה-baseline
--      (supabase/baseline/0001_baseline.sql).
--   2. חמש הטבלאות שכאן אינן בפרסום, ולכן המנויים עליהן ב-
--      app/screen/page.js וב-components/SecurityFieldStatus.js לעולם לא
--      נורים. הדפים עובדים בזכות פולינג מקביל, וזה מה שהסתיר את זה.
--   3. אין שום שאילתה ישירה מהדפדפן לחמש הטבלאות. הקריאות הישירות
--      היחידות שנותרו הן ב-app/sector-manager/page.js, והן נוגעות רק ב-
--      departments, contacts ו-duty_roster - שנשארות פתוחות.
--
-- כלומר ההרשאה על חמש הטבלאות היא נטל מיותר. ביטולה מוריד את החשיפה
-- מ-877 שורות ל-455, ומעלים את external_phone של 91 אנשי קשר, את
-- name/phone/email של 24 כוננים, ואת 271 שמות אנשי ביטחון.
--
-- הפיך: כדי לחזור אחורה יש ליצור מחדש את המדיניות ואת ההרשאה.
-- ================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'general_notifications',
    'call_category_contacts',
    'on_call_contacts',
    'security_daily_orders',
    'security_daily_order_entries'
  ] loop
    if to_regclass('public.' || t) is null then
      raise exception 'טבלה % לא קיימת - עצירה במקום דילוג שקט', t;
    end if;

    execute format('drop policy if exists anon_read_only on public.%I', t);
    execute format('revoke select on public.%I from anon', t);
  end loop;
end $$;

-- YOA-19: העמודה הזו נגישה לאנונימי למרות ש-20260813 העניקה במפורש רק
-- id, full_name, role, status. מסגירה אילו חשבונות ממתינים להחלפת סיסמה.
revoke select (must_change_password) on public.user_profiles from anon, authenticated;
