-- ===============================================
-- הוספת מנהלת מכלול: אוקסנה פרנק
-- מכלול: הנדסה ותשתיות
-- ===============================================

-- שלב 1: יצירת מכלול "הנדסה ותשתיות" (אם לא קיים)
INSERT INTO departments (name, manager_name, manager_phone, display_order)
VALUES ('הנדסה ותשתיות', 'אוקסנה פרנק', '+972 54-531-2875', 10)
ON CONFLICT (name) DO NOTHING;

-- שלב 2: שמירת department_id למשתנה
DO $$
DECLARE
  dept_id UUID;
  user_id UUID;
  temp_password TEXT := 'Oksana2026!';  -- סיסמה זמנית
BEGIN
  -- קבלת ID של המכלול
  SELECT id INTO dept_id 
  FROM departments 
  WHERE name = 'הנדסה ותשתיות';

  -- יצירת משתמש חדש ב-Supabase Auth
  -- הערה: זה לא יעבוד ב-SQL רגיל, צריך להריץ דרך Supabase Dashboard או API
  -- אבל אפשר להכין את הפרופיל מראש
  
  RAISE NOTICE 'Department ID: %', dept_id;
  RAISE NOTICE 'עכשיו צריך ליצור משתמש ב-Supabase Dashboard:';
  RAISE NOTICE 'Email: oksanaf@ye-mo.org.il';
  RAISE NOTICE 'Password: %', temp_password;
  RAISE NOTICE 'לאחר מכן הרץ את החלק הבא של הסקריפט עם ה-user_id';
END $$;

-- ===============================================
-- שלב 3: לאחר יצירת המשתמש ב-Dashboard
-- החלף את YOUR_USER_ID_HERE ב-ID האמיתי של המשתמש
-- ===============================================

-- עדכון פרופיל המשתמש
-- UPDATE user_profiles 
-- SET 
--   full_name = 'אוקסנה פרנק',
--   phone = '+972 54-531-2875',
--   role = 'sector_manager',
--   department_id = (SELECT id FROM departments WHERE name = 'הנדסה ותשתיות'),
--   must_change_password = true,
--   status = 'active'
-- WHERE id = 'YOUR_USER_ID_HERE';

-- הוספת audit log
-- INSERT INTO audit_log (user_id, action, details)
-- VALUES (
--   'YOUR_USER_ID_HERE',
--   'user_created',
--   'Created sector_manager user for הנדסה ותשתיות department'
-- );

-- ===============================================
-- הוראות הרצה:
-- ===============================================
-- 1. הרץ את שלב 1-2 ב-Supabase SQL Editor
-- 2. לך ל-Authentication > Users > Create new user
--    Email: oksanaf@ye-mo.org.il
--    Password: Oksana2026!
--    Auto Confirm User: YES (סמן V)
-- 3. העתק את ה-user_id שנוצר
-- 4. החלף YOUR_USER_ID_HERE בשלב 3 ב-ID האמיתי
-- 5. הסר את ה-comments (--) והרץ את שלב 3
-- ===============================================
