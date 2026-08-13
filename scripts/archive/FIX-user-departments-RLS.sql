-- =========================================
-- תיקון RLS על user_departments
-- הבעיה: המדיניות הקיימת לא נותנת גישה למנהלי מכלולים
-- =========================================

-- 1. הסר את המדיניות הישנה
DROP POLICY IF EXISTS "Users can view their own departments" ON user_departments;
DROP POLICY IF EXISTS "Admins can view all user departments" ON user_departments;
DROP POLICY IF EXISTS "Admins can manage all user departments" ON user_departments;

-- 2. צור מדיניות חדשה שעובדת נכון
-- משתמשים רואים את המחלקות שלהם
CREATE POLICY "Users can view their own departments" ON user_departments
  FOR SELECT
  USING (
    user_id = auth.uid()
  );

-- Admins רואים הכל
CREATE POLICY "Admins can view all user departments" ON user_departments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() 
        AND role IN ('admin', 'leadership')
        AND status = 'active'
    )
  );

-- Admins יכולים לנהל הכל
CREATE POLICY "Admins can manage all user departments" ON user_departments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() 
        AND role IN ('admin', 'leadership')
        AND status = 'active'
    )
  );

-- 3. בדיקה - הצג את כל המדיניות על user_departments
SELECT 
  '=== RLS Policies on user_departments ===' as info;

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_departments';

-- 4. בדיקה - נסה לשלוף נתונים כמו שהקוד עושה
-- זה יעבוד רק אם אתה מחובר כליאור בוקר
SELECT 
  '=== Test Query (should return 2 rows for Lior Boker) ===' as info;

SELECT 
  ud.department_id,
  ud.is_primary,
  d.id,
  d.name
FROM user_departments ud
JOIN departments d ON d.id = ud.department_id
WHERE ud.user_id = auth.uid()
ORDER BY ud.is_primary DESC;
