-- ===============================================
-- תיקון מהיר: חיבור אוקסנה למכלול הנדסה ותשתיות
-- הרץ את זה ב-Supabase SQL Editor
-- ===============================================

-- עדכון ישיר של הפרופיל של אוקסנה
UPDATE user_profiles
SET department_id = (
  SELECT id 
  FROM departments 
  WHERE name = 'מכלול הנדסה ותשתיות'
)
WHERE id = (
  SELECT id 
  FROM auth.users 
  WHERE email = 'oksanaf@ye-mo.org.il'
);

-- בדיקה שהעדכון עבד
SELECT 
  up.id,
  au.email,
  up.full_name,
  up.role,
  d.name as department_name,
  up.status,
  up.must_change_password
FROM user_profiles up
LEFT JOIN auth.users au ON up.id = au.id
LEFT JOIN departments d ON up.department_id = d.id
WHERE au.email = 'oksanaf@ye-mo.org.il';

-- אמור להראות:
-- id | email | full_name | role | department_name | status | must_change_password
-- ... | oksanaf@ye-mo.org.il | אוקסנה פרנק | sector_manager | מכלול הנדסה ותשתיות | active | true
