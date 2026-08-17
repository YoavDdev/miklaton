-- ================================================================
-- תיקון: המיגרציה הקודמת (20260817235500) לא סגרה את הפרצה
--
-- היא ביטלה EXECUTE מ-anon ומ-authenticated, אבל ב-PostgreSQL כל פונקציה
-- מקבלת EXECUTE ל-PUBLIC אוטומטית בעת יצירתה, ו-anon חבר ב-PUBLIC.
-- ביטול ההרשאה הישירה לא הסיר את ההרשאה שעוברת דרך PUBLIC, ולכן
-- add_user_to_department עדיין נענתה למפתח הציבורי (אומת: HTTP 409,
-- כלומר הגיעה עד ה-INSERT).
--
-- כאן מבוטלת ההרשאה מ-PUBLIC עצמו. service_role מחזיק GRANT מפורש
-- על כל פונקציה, ולכן ראוטי ה-API אינם מושפעים - אומת מול הפרודקשן.
-- ================================================================

revoke all on all functions in schema public from public;
alter default privileges in schema public revoke all on functions from public;
