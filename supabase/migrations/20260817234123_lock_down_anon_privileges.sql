-- ================================================================
-- YOA-20 — הגנה לעומק: ביטול הרשאות הכתיבה של anon ברמת הטבלה
--
-- הבעיה: כל 49 הטבלאות העניקו ל-anon (המפתח הציבורי שנשלח לכל דפדפן)
-- הרשאות INSERT, UPDATE, DELETE ו-TRUNCATE ברמת הטבלה. בפועל שום כתיבה
-- לא עברה, כי RLS מופעל על כל הטבלאות ויש רק חמש policies - וטבלה עם RLS
-- מופעל וללא policy חוסמת הכול.
--
-- אבל זו שכבת הגנה יחידה. שלושה תרחישים סבירים מפילים אותה:
--   1. כיבוי RLS על טבלה (לחיץ בדשבורד).
--   2. הוספת policy מתירנית מסוג `for all using (true)`.
--   3. טבלה חדשה שנוצרת בלי RLS - וההרשאה כבר שם מראש.
--
-- התרחיש השלישי הוא הסביר ביותר בפרויקט הזה, שבו טבלאות נוצרו ידנית
-- בדשבורד במשך שנה. השורה האחרונה כאן מטפלת בו.
--
-- אומת לפני ההרצה: אין שום קריאת כתיבה מקוד הדפדפן. שבעת הקבצים היחידים
-- שמייצרים לקוח עם מפתח anon (screen, operator, call-center-manager,
-- sector-manager, reset-password, OnCallManagerNew, SecurityFieldStatus)
-- עושים רק קריאות ומנויי realtime. כל הכתיבות עוברות בראוטי API עם
-- service role, שעוקף RLS והרשאות ולכן אינו מושפע.
-- ================================================================

revoke all on all tables in schema public from anon;

-- מחזירים רק את מה שנחוץ בפועל.
-- ארבע הטבלאות שנמצאות בפרסום supabase_realtime (YOA-18):
grant select on public.contacts to anon;
grant select on public.departments to anon;
grant select on public.duty_roster to anon;
grant select on public.war_mode to anon;

-- user_profiles: הרשאות ברמת עמודה, כפי ש-20260813 הגדירה.
grant select (id, full_name, role, status) on public.user_profiles to anon;

-- מונע את התרחיש של טבלה חדשה שנולדת פתוחה ל-anon.
alter default privileges in schema public revoke all on tables from anon;
