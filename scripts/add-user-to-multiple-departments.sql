-- =========================================
-- הוספת משתמש למספר מכלולים
-- Script זה מיועד למנהל שמנהל יותר ממכלול אחד
-- =========================================

-- שלב 1: מצא את ה-user_id של המשתמש לפי שם או email
-- החלף את <USER_EMAIL> במייל האמיתי של המשתמש
DO $$
DECLARE
  v_user_id UUID;
  v_dept1_id UUID;
  v_dept2_id UUID;
BEGIN
  -- מצא את ה-user_id
  SELECT id INTO v_user_id
  FROM user_profiles
  WHERE full_name LIKE '%<שם המשתמש>%'  -- או: email = '<USER_EMAIL>' מ-auth.users
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'משתמש לא נמצא! בדוק את השם או המייל';
    RETURN;
  END IF;
  
  RAISE NOTICE 'נמצא משתמש: %', v_user_id;
  
  -- מצא את המחלקות לפי שם
  SELECT id INTO v_dept1_id FROM departments WHERE name = 'הנהלת העיריה' LIMIT 1;
  SELECT id INTO v_dept2_id FROM departments WHERE name = 'מכלול עיבוד מידע ואוכלוסיה' LIMIT 1;
  
  IF v_dept1_id IS NULL OR v_dept2_id IS NULL THEN
    RAISE NOTICE 'אחת מהמחלקות לא נמצאה!';
    RAISE NOTICE 'הנהלת העיריה: %', v_dept1_id;
    RAISE NOTICE 'מכלול עיבוד מידע: %', v_dept2_id;
    RETURN;
  END IF;
  
  -- הוסף את המשתמש לשתי המחלקות
  -- המחלקה הראשונה תהיה ה-primary
  PERFORM add_user_to_department(v_user_id, v_dept1_id, true);
  PERFORM add_user_to_department(v_user_id, v_dept2_id, false);
  
  RAISE NOTICE 'המשתמש נוסף בהצלחה לשתי המחלקות!';
  RAISE NOTICE 'מחלקה ראשית: הנהלת העיריה';
  RAISE NOTICE 'מחלקה נוספת: מכלול עיבוד מידע ואוכלוסיה';
END $$;

-- בדיקה: הצג את כל המחלקות של המשתמש
SELECT 
  up.full_name,
  up.email,
  d.name as department_name,
  ud.is_primary
FROM user_profiles up
JOIN user_departments ud ON ud.user_id = up.id
JOIN departments d ON d.id = ud.department_id
WHERE up.full_name LIKE '%<שם המשתמש>%'
ORDER BY ud.is_primary DESC;
