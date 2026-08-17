-- ===============================================
-- יצירת משתמש Admin ראשון - מקלטון
-- ===============================================
-- ⚠️ הוראות חשובות - בצע לפי הסדר:
--
-- שלב 1: כיבוי RLS על user_profiles (חובה!)
-- -----------------------------------------------
-- הרץ את הפקודה הזו ב-SQL Editor:
--
--   ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
--
-- ⚠️ זה פותר את הבעיה "Database error querying schema" בהתחברות
--
-- שלב 2: יצירת משתמש Admin ב-Dashboard
-- -----------------------------------------------
-- 1. לך ל-Supabase Dashboard
-- 2. Authentication → Users → "Add user" → Manual
-- 3. מלא:
--    • Email: admin@miklaton.com (או אימייל אחר)
--    • Password: Admin123! (או סיסמה חזקה אחרת)
--    • ✅ סמן "Auto Confirm User"
-- 4. לחץ "Create user"
--
-- שלב 3: שדרוג המשתמש ל-Admin
-- -----------------------------------------------
-- הרץ את הסקריפט למטה (משורה 38) ב-SQL Editor
-- ===============================================

-- ❌ אל תריץ את החלק הזה - זה לא עובד עם Supabase Auth:
-- השתמש ב-Dashboard במקום (ראה למעלה)

-- ===============================================
-- ✅ הרץ רק את זה - אחרי יצירת המשתמש ב-Dashboard:
-- ===============================================

DO $$
DECLARE
  new_user_id UUID;
  admin_email TEXT := 'admin@miklaton.com'; -- 👈 **החלף כאן לאימייל שיצרת ב-Dashboard**
  admin_name TEXT := 'מנהל מערכת'; -- 👈 **החלף כאן את השם**
  admin_phone TEXT := NULL; -- 👈 **אופציונלי - מספר טלפון**
BEGIN
  
  -- שליפת ה-ID של המשתמש שיצרת ב-Dashboard
  SELECT id INTO new_user_id FROM auth.users WHERE email = admin_email;
  
  IF new_user_id IS NULL THEN
    RAISE EXCEPTION 'משתמש עם האימייל % לא נמצא! צור אותו ב-Dashboard קודם', admin_email;
  END IF;

  -- שלב 2: עדכון/יצירת profile
  INSERT INTO user_profiles (
    id,
    full_name,
    phone,
    role,
    status,
    approved_by,
    approved_at
  ) VALUES (
    new_user_id,
    admin_name,
    admin_phone,
    'admin',
    'active',
    new_user_id, -- Admin מאשר את עצמו
    NOW()
  )
  ON CONFLICT (id) 
  DO UPDATE SET
    role = 'admin',
    status = 'active',
    approved_by = new_user_id,
    approved_at = NOW();

  RAISE NOTICE 'פרופיל Admin עודכן בהצלחה!';

  -- שלב 3: Audit log
  INSERT INTO audit_log (
    user_id,
    action,
    details
  ) VALUES (
    new_user_id,
    'admin_created',
    jsonb_build_object(
      'email', admin_email,
      'name', admin_name,
      'created_via', 'SQL script'
    )
  );

  RAISE NOTICE '✅ משתמש Admin שודרג בהצלחה!';
  RAISE NOTICE 'אימייל: %', admin_email;
  RAISE NOTICE 'תפקיד: Admin';
  RAISE NOTICE 'סטטוס: פעיל';
  RAISE NOTICE '';
  RAISE NOTICE '🔐 כעת תוכל להתחבר ב-/login עם הסיסמה שהגדרת ב-Dashboard!';
  
END $$;

-- בדיקה שהכל עבד
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at,
  p.full_name,
  p.role,
  p.status,
  p.created_at
FROM auth.users u
JOIN user_profiles p ON u.id = p.id
WHERE p.role = 'admin'
ORDER BY p.created_at DESC;
