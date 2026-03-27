-- =========================================
-- User Departments - Many-to-Many Relationship
-- מאפשר למשתמשים להיות משוייכים למספר מכלולים
-- Created: 27.03.2026
-- =========================================

-- יצירת טבלת קישור בין משתמשים למחלקות
CREATE TABLE IF NOT EXISTS user_departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- מניעת כפילויות - משתמש לא יכול להיות משוייך פעמיים לאותו מכלול
  UNIQUE(user_id, department_id)
);

-- אינדקסים לביצועים
CREATE INDEX IF NOT EXISTS idx_user_departments_user ON user_departments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_dept ON user_departments(department_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_primary ON user_departments(is_primary) WHERE is_primary = true;

-- העברת נתונים קיימים מ-user_profiles.department_id ל-user_departments
-- כל משתמש קיים עם department_id יקבל רשומה ב-user_departments
INSERT INTO user_departments (user_id, department_id, is_primary)
SELECT 
  id as user_id,
  department_id,
  true as is_primary
FROM user_profiles
WHERE department_id IS NOT NULL
ON CONFLICT (user_id, department_id) DO NOTHING;

-- הוספת הערה: אנחנו לא מוחקים את user_profiles.department_id
-- כדי לשמור על backward compatibility עם קוד קיים
-- אבל מעכשיו נשתמש ב-user_departments

-- =========================================
-- פונקציה לקבלת כל המחלקות של משתמש
-- =========================================
CREATE OR REPLACE FUNCTION get_user_departments(user_uuid UUID)
RETURNS TABLE(department_id UUID, department_name VARCHAR, is_primary BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ud.department_id,
    d.name,
    ud.is_primary
  FROM user_departments ud
  JOIN departments d ON d.id = ud.department_id
  WHERE ud.user_id = user_uuid
  ORDER BY ud.is_primary DESC, d.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================
-- פונקציה לעדכון המחלקה הראשית
-- =========================================
CREATE OR REPLACE FUNCTION set_primary_department(user_uuid UUID, dept_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- ודא שהמשתמש משוייך למחלקה הזו
  IF NOT EXISTS (
    SELECT 1 FROM user_departments 
    WHERE user_id = user_uuid AND department_id = dept_uuid
  ) THEN
    RETURN false;
  END IF;
  
  -- הסר primary מכל המחלקות של המשתמש
  UPDATE user_departments
  SET is_primary = false
  WHERE user_id = user_uuid;
  
  -- קבע את המחלקה החדשה כ-primary
  UPDATE user_departments
  SET is_primary = true
  WHERE user_id = user_uuid AND department_id = dept_uuid;
  
  -- עדכן גם ב-user_profiles לשמירת backward compatibility
  UPDATE user_profiles
  SET department_id = dept_uuid
  WHERE id = user_uuid;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================
-- פונקציה להוספת משתמש למחלקה נוספת
-- =========================================
CREATE OR REPLACE FUNCTION add_user_to_department(user_uuid UUID, dept_uuid UUID, make_primary BOOLEAN DEFAULT false)
RETURNS BOOLEAN AS $$
BEGIN
  -- הוסף את המשתמש למחלקה
  INSERT INTO user_departments (user_id, department_id, is_primary)
  VALUES (user_uuid, dept_uuid, make_primary)
  ON CONFLICT (user_id, department_id) DO NOTHING;
  
  -- אם צריך להפוך ל-primary, קרא לפונקציה המתאימה
  IF make_primary THEN
    PERFORM set_primary_department(user_uuid, dept_uuid);
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================
-- RLS Policies
-- =========================================
ALTER TABLE user_departments ENABLE ROW LEVEL SECURITY;

-- Policy: משתמשים רואים את המחלקות שלהם
CREATE POLICY "Users can view their own departments" ON user_departments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Admins רואים הכל
CREATE POLICY "Admins can view all user departments" ON user_departments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- Policy: Admins יכולים לנהל הכל
CREATE POLICY "Admins can manage all user departments" ON user_departments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- =========================================
-- DONE! ✅
-- =========================================
-- עכשיו משתמשים יכולים להיות משוייכים למספר מכלולים
-- והמערכת תציג להם selector לבחירת המכלול הפעיל
