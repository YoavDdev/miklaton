-- ===============================================
-- תיקון דחוף: חיבור אוקסנה למכלול - גרסה עם בדיקות
-- ===============================================

-- 1. בדיקה אם אוקסנה קיימת
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'oksanaf@ye-mo.org.il') THEN
        RAISE EXCEPTION 'אוקסנה לא קיימת ב-auth.users!';
    END IF;
    RAISE NOTICE '✅ אוקסנה קיימת ב-auth.users';
END $$;

-- 2. בדיקה אם המכלול קיים
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM departments WHERE name = 'מכלול הנדסה ותשתיות') THEN
        RAISE EXCEPTION 'מכלול הנדסה ותשתיות לא קיים!';
    END IF;
    RAISE NOTICE '✅ מכלול הנדסה ותשתיות קיים';
END $$;

-- 3. בדיקה אם הפרופיל קיים
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM user_profiles up
        JOIN auth.users au ON up.id = au.id
        WHERE au.email = 'oksanaf@ye-mo.org.il'
    ) THEN
        RAISE EXCEPTION 'פרופיל של אוקסנה לא קיים ב-user_profiles!';
    END IF;
    RAISE NOTICE '✅ פרופיל של אוקסנה קיים';
END $$;

-- 4. עדכון ה-department_id - בדרך הכי פשוטה
UPDATE user_profiles
SET department_id = 'ec7f5902-e5e6-4a03-b030-67548c52e71d'
WHERE id = '62f0ecf6-0d5d-4794-b5d2-d499be25db24';

-- 5. בדיקה שהעדכון עבד
DO $$
DECLARE
    dept_id UUID;
BEGIN
    SELECT department_id INTO dept_id
    FROM user_profiles
    WHERE id = '62f0ecf6-0d5d-4794-b5d2-d499be25db24';
    
    IF dept_id IS NULL THEN
        RAISE EXCEPTION '❌ העדכון נכשל! department_id עדיין NULL';
    ELSE
        RAISE NOTICE '✅ העדכון הצליח! department_id = %', dept_id;
    END IF;
END $$;

-- 6. הצגת התוצאה הסופית
SELECT 
  up.id,
  au.email,
  up.full_name,
  up.role,
  up.department_id,
  d.name as department_name,
  up.status
FROM user_profiles up
JOIN auth.users au ON up.id = au.id
LEFT JOIN departments d ON up.department_id = d.id
WHERE au.email = 'oksanaf@ye-mo.org.il';
