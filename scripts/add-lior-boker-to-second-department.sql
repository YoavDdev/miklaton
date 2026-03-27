-- =========================================
-- הוספת ליאור בוקר למכלול עיבוד מידע ואוכלוסיה
-- =========================================
-- משתמש: ליאור בוקר
-- מכלול ראשי (קיים): הנהלת העירייה
-- מכלול נוסף (חדש): מכלול עיבוד מידע ואוכלוסיה
-- =========================================

DO $$
DECLARE
  v_user_id UUID;
  v_user_name VARCHAR;
  v_user_email VARCHAR;
  v_primary_dept_id UUID := 'b4dddded-0d07-42d6-b447-dde2c58bddc9'; -- הנהלת העירייה
  v_second_dept_id UUID := '7158883b-5893-46f0-856d-ea3b3aa63e35';  -- מכלול עיבוד מידע ואוכלוסיה
  v_primary_dept_name VARCHAR;
  v_second_dept_name VARCHAR;
BEGIN
  -- 1. מצא את ליאור בוקר במערכת
  SELECT up.id, up.full_name, au.email
  INTO v_user_id, v_user_name, v_user_email
  FROM user_profiles up
  JOIN auth.users au ON au.id = up.id
  WHERE up.full_name LIKE '%ליאור%בוקר%' 
     OR up.full_name LIKE '%בוקר%ליאור%'
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '❌ משתמש "ליאור בוקר" לא נמצא במערכת!';
  END IF;
  
  RAISE NOTICE '✅ נמצא משתמש: % (מייל: %)', v_user_name, v_user_email;
  
  -- 2. בדוק ששני המכלולים קיימים
  SELECT name INTO v_primary_dept_name FROM departments WHERE id = v_primary_dept_id;
  SELECT name INTO v_second_dept_name FROM departments WHERE id = v_second_dept_id;
  
  IF v_primary_dept_name IS NULL OR v_second_dept_name IS NULL THEN
    RAISE EXCEPTION '❌ אחד המכלולים לא נמצא במערכת!';
  END IF;
  
  RAISE NOTICE '📋 מכלול ראשי: %', v_primary_dept_name;
  RAISE NOTICE '📋 מכלול נוסף: %', v_second_dept_name;
  
  -- 3. ודא שהמכלול הראשי מוגדר כ-primary ב-user_departments
  INSERT INTO user_departments (user_id, department_id, is_primary)
  VALUES (v_user_id, v_primary_dept_id, true)
  ON CONFLICT (user_id, department_id) 
  DO UPDATE SET is_primary = true;
  
  -- 4. הוסף את המכלול השני
  INSERT INTO user_departments (user_id, department_id, is_primary)
  VALUES (v_user_id, v_second_dept_id, false)
  ON CONFLICT (user_id, department_id) DO NOTHING;
  
  -- 5. ודא ש-user_profiles.department_id מצביע על המכלול הראשי
  UPDATE user_profiles
  SET department_id = v_primary_dept_id
  WHERE id = v_user_id;
  
  RAISE NOTICE '';
  RAISE NOTICE '🎉 הצלחה! % מנהל עכשיו 2 מכלולים:', v_user_name;
  RAISE NOTICE '';
  
  -- 6. הצג סיכום של כל המכלולים
  DECLARE
    dept_record RECORD;
  BEGIN
    FOR dept_record IN 
      SELECT 
        d.name,
        ud.is_primary,
        CASE WHEN ud.is_primary THEN 1 ELSE 2 END as sort_order
      FROM user_departments ud
      JOIN departments d ON d.id = ud.department_id
      WHERE ud.user_id = v_user_id
      ORDER BY sort_order
    LOOP
      IF dept_record.is_primary THEN
        RAISE NOTICE '   1. % ⭐ (ראשי)', dept_record.name;
      ELSE
        RAISE NOTICE '   2. %', dept_record.name;
      END IF;
    END LOOP;
  END;
  
  RAISE NOTICE '';
  RAISE NOTICE '💡 כשליאור בוקר ייכנס ל-/sector-manager הוא יראה dropdown לבחירת מכלול';
  
END $$;

-- בדיקה סופית - הצג את התוצאה
SELECT 
  '=== התוצאה הסופית ===' as info;

SELECT 
  up.full_name,
  au.email,
  d.name as department_name,
  ud.is_primary
FROM user_departments ud
JOIN user_profiles up ON up.id = ud.user_id
JOIN auth.users au ON au.id = up.id
JOIN departments d ON d.id = ud.department_id
WHERE up.full_name LIKE '%ליאור%בוקר%'
ORDER BY ud.is_primary DESC;
