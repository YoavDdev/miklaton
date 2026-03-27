-- =========================================
-- מדריך מלא: הוספת מנהל מכלול ל-2 מכלולים
-- =========================================

-- ✅ שלב 1: ודא שהמשתמש קיים במערכת עם role = 'manager'
-- אם המשתמש עדיין לא קיים - צור אותו דרך ממשק ההרשמה או Admin Panel

-- ✅ שלב 2: הרץ את הסקריפט הזה כדי לראות את כל המכלולים והמשתמשים
SELECT '=== רשימת כל המכלולים ===' as info;
SELECT id, name FROM departments ORDER BY name;

SELECT '=== רשימת מנהלי מכלולים ===' as info;
SELECT 
  au.email,
  up.full_name,
  up.role,
  d.name as current_department
FROM user_profiles up
JOIN auth.users au ON au.id = up.id
LEFT JOIN departments d ON d.id = up.department_id
WHERE up.role = 'manager'
ORDER BY up.full_name;

-- ✅ שלב 3: מצא את המשתמש והמכלולים הרלוונטיים
-- החלף את הערכים למטה:

-- 🔧 **שנה כאן** - הכנס את המייל של המנהל:
-- דוגמה: 'yoav@example.com'

-- 🔧 **שנה כאן** - העתק את ה-ID של המכלול הראשון מהטבלה למעלה
-- דוגמה: 'ec7f5902-e5e6-4a03-b030-67548c52e71d'

-- 🔧 **שנה כאן** - העתק את ה-ID של המכלול השני מהטבלה למעלה
-- דוגמה: 'abc12345-1234-1234-1234-123456789abc'

-- =========================================
-- ✅ שלב 4: הרץ את הסקריפט הזה
-- =========================================
DO $$
DECLARE
  v_user_id UUID;
  v_user_email VARCHAR := 'CHANGE_ME@example.com';  -- 🔧 שנה כאן!
  v_dept1_id UUID := 'CHANGE_ME_DEPT1_UUID';        -- 🔧 שנה כאן!
  v_dept2_id UUID := 'CHANGE_ME_DEPT2_UUID';        -- 🔧 שנה כאן!
  v_user_name VARCHAR;
  v_dept1_name VARCHAR;
  v_dept2_name VARCHAR;
BEGIN
  -- מצא את המשתמש
  SELECT au.id, up.full_name
  INTO v_user_id, v_user_name
  FROM auth.users au
  JOIN user_profiles up ON up.id = au.id
  WHERE au.email = v_user_email AND up.role = 'manager';
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '❌ משתמש עם מייל % עם role = manager לא נמצא!', v_user_email;
  END IF;
  
  -- מצא את שמות המכלולים
  SELECT name INTO v_dept1_name FROM departments WHERE id = v_dept1_id;
  SELECT name INTO v_dept2_name FROM departments WHERE id = v_dept2_id;
  
  IF v_dept1_name IS NULL OR v_dept2_name IS NULL THEN
    RAISE EXCEPTION '❌ אחד המכלולים לא נמצא! בדוק את ה-UUIDs';
  END IF;
  
  RAISE NOTICE '✅ נמצא משתמש: %', v_user_name;
  RAISE NOTICE '📋 מכלול 1: %', v_dept1_name;
  RAISE NOTICE '📋 מכלול 2: %', v_dept2_name;
  
  -- הוסף את המשתמש לשני המכלולים
  -- המכלול הראשון יהיה ה-primary
  INSERT INTO user_departments (user_id, department_id, is_primary)
  VALUES (v_user_id, v_dept1_id, true)
  ON CONFLICT (user_id, department_id) 
  DO UPDATE SET is_primary = true;
  
  INSERT INTO user_departments (user_id, department_id, is_primary)
  VALUES (v_user_id, v_dept2_id, false)
  ON CONFLICT (user_id, department_id) DO NOTHING;
  
  -- עדכן גם את user_profiles.department_id להיות המכלול הראשי
  UPDATE user_profiles
  SET department_id = v_dept1_id
  WHERE id = v_user_id;
  
  RAISE NOTICE '🎉 הצלחה! % מנהל עכשיו את המכלולים:', v_user_name;
  RAISE NOTICE '   1. % ⭐ (ראשי)', v_dept1_name;
  RAISE NOTICE '   2. %', v_dept2_name;
  
END $$;

-- ✅ שלב 5: בדיקה - הצג את התוצאה
SELECT 
  up.full_name as manager_name,
  d.name as department_name,
  ud.is_primary as is_primary_department
FROM user_departments ud
JOIN user_profiles up ON up.id = ud.user_id
JOIN departments d ON d.id = ud.department_id
WHERE up.role = 'manager'
ORDER BY up.full_name, ud.is_primary DESC;
