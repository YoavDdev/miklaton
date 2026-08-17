-- הוספת שדה must_change_password לטבלת user_profiles
-- תאריך: 26 מרץ 2026

-- הוספת עמודה חדשה
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- עדכון ערך ברירת מחדל למשתמשים שנוצרו ע"י אדמין להיות true
COMMENT ON COLUMN user_profiles.must_change_password IS 'האם המשתמש חייב לשנות את הסיסמה בהתחברות הבאה';

-- אינדקס לשאילתות מהירות
CREATE INDEX IF NOT EXISTS idx_user_profiles_must_change_password 
ON user_profiles(must_change_password) 
WHERE must_change_password = true;
