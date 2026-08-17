-- ================================================================
-- פרצה חיה: anon יכול להריץ פונקציות SECURITY DEFINER ששומרות נתונים
--
-- אומת בפרודקשן ב-2026-08-18 בבדיקה שאינה כותבת דבר: קריאה ל-
-- POST /rest/v1/rpc/add_user_to_department עם המפתח הציבורי החזירה
-- HTTP 409 עם הפרת מפתח זר - כלומר הבקשה עברה את בדיקת ההרשאות והגיעה
-- עד ה-INSERT עצמו, ונעצרה רק כי ה-UUID שנשלח לא קיים.
--
-- add_user_to_department היא SECURITY DEFINER בבעלות postgres, ולכן היא
-- עוקפת RLS ומכניסה שורה ל-user_departments. set_primary_department זהה.
--
-- שני המרכיבים הדרושים לניצול היו גלויים: anon קורא את 21 מזהי המשתמשים
-- עם התפקידים שלהם, ואת 12 מזהי המחלקות. כלומר כל מי שמחזיק במפתח
-- הציבורי - שנשלח לכל דפדפן - יכול היה לשייך כל משתמש לכל מחלקה.
-- ל-can_edit_duty_roster יש תלות בשיוך הזה, ולכן זו גם שאלה של הרשאות
-- ולא רק של שלמות נתונים.
--
-- אומת שאין רגרסיה: אין ולו קריאת .rpc() אחת בכל קוד הדפדפן. ראוטי ה-API
-- משתמשים ב-service role, שאינו מושפע מהביטול הזה.
--
-- מבוטל גם מ-authenticated: ההרשמה למערכת פתוחה, ולכן תוקף יכול להשיג
-- session ולעלות לתפקיד הזה.
-- ================================================================

revoke all on all functions in schema public from anon, authenticated;

-- מונע מפונקציות עתידיות להיוולד פתוחות - זו היתה ברירת המחדל עד כה.
alter default privileges in schema public revoke all on functions from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
