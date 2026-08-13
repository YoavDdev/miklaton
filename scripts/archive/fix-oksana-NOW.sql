-- ===============================================
-- תיקון מהיר: הוספת שדה must_change_password + יצירת פרופיל לאוקסנה
-- הרץ את זה ב-Supabase SQL Editor
-- ===============================================

-- שלב 1: הוספת השדה החסר
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- שלב 2: מצא את ה-user_id של אוקסנה מ-Auth
-- ויצור לה פרופיל

DO $$
DECLARE
  oksana_user_id UUID;
  dept_id UUID;
BEGIN
  -- קבלת department_id של הנדסה ותשתיות
  SELECT id INTO dept_id 
  FROM departments 
  WHERE name = 'מכלול הנדסה ותשתיות';

  -- חיפוש user_id של אוקסנה מטבלת auth.users
  SELECT id INTO oksana_user_id
  FROM auth.users
  WHERE email = 'oksanaf@ye-mo.org.il';

  -- אם נמצא - צור/עדכן את הפרופיל
  IF oksana_user_id IS NOT NULL THEN
    INSERT INTO user_profiles (
      id, 
      full_name, 
      phone, 
      role, 
      department_id, 
      status, 
      must_change_password
    )
    VALUES (
      oksana_user_id,
      'אוקסנה פרנק',
      '+972 54-531-2875',
      'sector_manager',
      dept_id,
      'active',
      true
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = 'אוקסנה פרנק',
      phone = '+972 54-531-2875',
      role = 'sector_manager',
      department_id = dept_id,
      status = 'active',
      must_change_password = true;

    RAISE NOTICE '✅ פרופיל של אוקסנה נוצר/עודכן בהצלחה!';
  ELSE
    RAISE NOTICE '⚠️ לא נמצא משתמש עם email: oksanaf@ye-mo.org.il';
    RAISE NOTICE 'צור את המשתמש תחילה דרך Admin Panel';
  END IF;
END $$;

-- בדיקה שהכל תקין
SELECT 
  up.id,
  au.email,
  up.full_name,
  up.role,
  d.name as department_name,
  up.must_change_password,
  up.status
FROM user_profiles up
LEFT JOIN departments d ON up.department_id = d.id
LEFT JOIN auth.users au ON up.id = au.id
WHERE au.email = 'oksanaf@ye-mo.org.il';
