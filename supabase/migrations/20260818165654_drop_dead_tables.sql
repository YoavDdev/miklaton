-- ================================================================
-- מחיקת חמש טבלאות מתות (YOA-28)
--
-- כל אחת מהן אומתה פעמיים ממש לפני המחיקה:
--   * אפס שורות בפרודקשן
--   * אפס הפניות בכל app/, components/, lib/ ו-scripts/
--
-- operator_shifts, shift_messages - שרידים ממערכת משמרות מוקדמת שהוחלפה
-- ב-call_center_schedule ו-operator_sessions.
-- sector_daily_tasks, sector_staff, sector_weekly_schedule - שלד למכלולים
-- שמעולם לא חובר לממשק. הסידור של מכלול בטחון חי ב-security_* ולא כאן.
--
-- הטבלאות נשמרות בהיסטוריית ה-baseline בגיט; מי שיצטרך אותן יוכל לשחזר
-- את ה-DDL מ-supabase/archive/ או מקומיט קודם של הסכימה.
--
-- לא נמחק בכוונה: inspection_reports. היא ריקה, אבל היא נוצרה ב-YOA-10
-- כתיקון מכוון (דוחות פיקוח לא נשמרו ב-Vercel), ורק הממשק שלה טרם נבנה.
-- פיצ'ר חצי-בנוי אינו קוד מת.
-- ================================================================

drop table if exists public.operator_shifts cascade;
drop table if exists public.shift_messages cascade;
drop table if exists public.sector_daily_tasks cascade;
drop table if exists public.sector_staff cascade;
drop table if exists public.sector_weekly_schedule cascade;
