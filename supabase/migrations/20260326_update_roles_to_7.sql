-- =========================================
-- Update Roles: 5 → 7 Roles
-- Created: 26.03.2026
-- =========================================
-- עדכון מבנה התפקידים מ-5 ל-7 תפקידים חדשים:
-- 1. ceo - מנכ"ל עיריה
-- 2. call_center_manager - מנהלת מוקד עירוני
-- 3. sector_manager - מנהל מכלול (לשעבר 'manager')
-- 4. operator - מוקדן
-- 5. admin - אדמין
-- 6. inspector - פקח/שיטור עירוני
-- 7. shelter_manager - אחראי מקלטים

-- שלב 1: מיפוי תפקידים ישנים לחדשים
-- =========================================
-- manager → sector_manager
-- leadership → ceo (או sector_manager, תלוי במקרה)

UPDATE user_profiles
SET role = 'sector_manager'
WHERE role = 'manager';

UPDATE user_profiles
SET role = 'ceo'
WHERE role = 'leadership';

-- שלב 2: עדכון ה-constraint ל-7 תפקידים חדשים
-- =========================================
ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS valid_role;

ALTER TABLE user_profiles
ADD CONSTRAINT valid_role CHECK (
  role IN (
    'ceo',
    'call_center_manager',
    'sector_manager',
    'operator',
    'admin',
    'inspector',
    'shelter_manager'
  )
);

-- שלב 3: עדכון הפונקציות
-- =========================================
-- עדכון can_edit_duty_roster לתפקידים החדשים
CREATE OR REPLACE FUNCTION can_edit_duty_roster(user_uuid UUID, dept_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role VARCHAR;
  user_dept UUID;
BEGIN
  SELECT role, department_id INTO user_role, user_dept
  FROM user_profiles
  WHERE id = user_uuid AND status = 'active';
  
  -- Admin או CEO יכולים לערוך הכל
  IF user_role IN ('admin', 'ceo') THEN
    RETURN true;
  END IF;
  
  -- Sector Manager יכול לערוך רק את המכלול שלו
  IF user_role = 'sector_manager' AND user_dept = dept_id THEN
    RETURN true;
  END IF;
  
  -- Call Center Manager יכולה לערוך כוננות של מוקדנים
  IF user_role = 'call_center_manager' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- שלב 4: הוספת פונקציות עזר חדשות
-- =========================================

-- בדיקה אם משתמש הוא CEO
CREATE OR REPLACE FUNCTION is_ceo(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_uuid AND role = 'ceo' AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- בדיקה אם משתמש הוא Sector Manager
CREATE OR REPLACE FUNCTION is_sector_manager(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_uuid AND role = 'sector_manager' AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- בדיקה אם משתמש הוא Call Center Manager
CREATE OR REPLACE FUNCTION is_call_center_manager(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_uuid AND role = 'call_center_manager' AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================
-- DONE! ✅
-- =========================================
-- התפקידים עודכנו ל-7 תפקידים חדשים
-- מוכן לשימוש עם המערכת המעודכנת
