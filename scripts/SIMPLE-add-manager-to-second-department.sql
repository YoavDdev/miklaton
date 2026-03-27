-- =========================================
-- הוספת מנהל מכלול למכלול נוסף (פשוט!)
-- =========================================
-- 
-- שימוש:
-- 1. החלף את המייל של המשתמש למטה
-- 2. החלף את שם המכלול הנוסף
-- 3. הרץ את הסקריפט ב-Supabase SQL Editor
--
-- =========================================

-- 🔧 **שנה כאן** - הכנס את המייל של המנהל:
\set USER_EMAIL 'manager@example.com'

-- 🔧 **שנה כאן** - הכנס את שם המכלול הנוסף (מעתיק מרשימת המכלולים):
\set SECOND_DEPT_NAME 'מכלול עיבוד מידע ואוכלוסיה'

-- =========================================
-- הסקריפט מתחיל כאן - אל תשנה כלום מתחת לשורה הזו!
-- =========================================

DO $$
DECLARE
  v_user_id UUID;
  v_user_name VARCHAR;
  v_dept_id UUID;
  v_dept_name VARCHAR;
  v_primary_dept VARCHAR;
BEGIN
  -- 1. מצא את המשתמש לפי מייל
  SELECT au.id, up.full_name, d.name
  INTO v_user_id, v_user_name, v_primary_dept
  FROM auth.users au
  JOIN user_profiles up ON up.id = au.id
  LEFT JOIN departments d ON d.id = up.department_id
  WHERE au.email = :'USER_EMAIL';
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '❌ משתמש עם מייל % לא נמצא במערכת!', :'USER_EMAIL';
  END IF;
  
  RAISE NOTICE '✅ נמצא משתמש: % (ID: %)', v_user_name, v_user_id;
  RAISE NOTICE '📋 מכלול ראשי: %', v_primary_dept;
  
  -- 2. מצא את המכלול הנוסף לפי שם
  SELECT id, name INTO v_dept_id, v_dept_name
  FROM departments
  WHERE name = :'SECOND_DEPT_NAME';
  
  IF v_dept_id IS NULL THEN
    RAISE EXCEPTION '❌ מכלול בשם "%" לא נמצא במערכת!', :'SECOND_DEPT_NAME';
  END IF;
  
  RAISE NOTICE '✅ נמצא מכלול: % (ID: %)', v_dept_name, v_dept_id;
  
  -- 3. בדוק אם המשתמש כבר משוייך למכלול הזה
  IF EXISTS (
    SELECT 1 FROM user_departments 
    WHERE user_id = v_user_id AND department_id = v_dept_id
  ) THEN
    RAISE NOTICE '⚠️  המשתמש כבר משוייך למכלול "%"', v_dept_name;
  ELSE
    -- 4. הוסף את המשתמש למכלול הנוסף
    INSERT INTO user_departments (user_id, department_id, is_primary)
    VALUES (v_user_id, v_dept_id, false);
    
    RAISE NOTICE '🎉 הצלחה! המשתמש % נוסף למכלול "%"', v_user_name, v_dept_name;
  END IF;
  
  -- 5. הצג סיכום של כל המכלולים של המשתמש
  RAISE NOTICE '';
  RAISE NOTICE '📊 סיכום - המשתמש % משוייך למכלולים הבאים:', v_user_name;
  
  FOR v_dept_name IN 
    SELECT d.name || CASE WHEN ud.is_primary THEN ' ⭐ (ראשי)' ELSE '' END
    FROM user_departments ud
    JOIN departments d ON d.id = ud.department_id
    WHERE ud.user_id = v_user_id
    ORDER BY ud.is_primary DESC
  LOOP
    RAISE NOTICE '   - %', v_dept_name;
  END LOOP;
  
END $$;
