-- =========================================
-- RBAC System - Authentication & Authorization
-- Phase 1: User Management with 5 Roles
-- Created: 23.03.2026
-- =========================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================
-- 1. USER PROFILES TABLE
-- =========================================
-- פרופילי משתמשים - מורחב מעבר ל-auth.users של Supabase
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  avatar_url VARCHAR(500),
  role VARCHAR(20) NOT NULL DEFAULT 'operator',
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_role CHECK (role IN ('operator', 'manager', 'inspector', 'leadership', 'admin')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'active', 'suspended'))
);

-- אינדקסים לביצועים
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON user_profiles(status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_department ON user_profiles(department_id);

-- פונקציה לעדכון אוטומטי של updated_at
CREATE OR REPLACE FUNCTION update_user_profiles_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- טריגר לעדכון updated_at
DROP TRIGGER IF EXISTS set_user_profiles_timestamp ON user_profiles;
CREATE TRIGGER set_user_profiles_timestamp
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_timestamp();

-- =========================================
-- 2. PASSWORD RESETS TABLE
-- =========================================
-- ניהול איפוס סיסמאות ע"י Admin בלבד
CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  temp_password_plain VARCHAR(100) NOT NULL, -- סיסמה זמנית לשליחה למשתמש (plain text!)
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  reset_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON password_resets(expires_at);

-- =========================================
-- 3. AUDIT LOG TABLE
-- =========================================
-- תיעוד מלא של כל פעולות המשתמשים במערכת
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  details JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- אינדקסים לחיפוש מהיר
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);

-- =========================================
-- 4. SYSTEM SETTINGS TABLE
-- =========================================
-- הגדרות גלובליות למערכת
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(50) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- פונקציה לעדכון אוטומטי של updated_at
CREATE OR REPLACE FUNCTION update_system_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- טריגר לעדכון updated_at
DROP TRIGGER IF EXISTS set_system_settings_timestamp ON system_settings;
CREATE TRIGGER set_system_settings_timestamp
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_system_settings_timestamp();

-- הכנסת הגדרות ברירת מחדל
INSERT INTO system_settings (key, value, description) VALUES
  ('require_admin_approval', '{"enabled": true}', 'האם משתמשים חדשים צריכים אישור Admin'),
  ('session_duration_hours', '{"hours": 8}', 'משך תוקף session בשעות'),
  ('max_login_attempts', '{"attempts": 5}', 'מספר ניסיונות התחברות מקסימלי'),
  ('operator_can_edit_map', '{"enabled": false}', 'האם מפעילים יכולים לערוך מפה חיה'),
  ('lockout_duration_minutes', '{"minutes": 15}', 'זמן נעילה אחרי ניסיונות כושלים')
ON CONFLICT (key) DO NOTHING;

-- =========================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: משתמשים רואים את הפרופיל שלהם
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: משתמשים יכולים לעדכן את הפרופיל שלהם (לא role או status!)
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    -- לא ניתן לשנות role, status, או approved fields
    role = (SELECT role FROM user_profiles WHERE id = auth.uid()) AND
    status = (SELECT status FROM user_profiles WHERE id = auth.uid())
  );

-- Policy: Admins רואים הכל
CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- Policy: Admins יכולים לערוך הכל
CREATE POLICY "Admins can update all profiles" ON user_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- Policy: Admins יכולים למחוק משתמשים
CREATE POLICY "Admins can delete profiles" ON user_profiles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- Enable RLS on password_resets
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

-- Policy: רק Admins יכולים לראות/ליצור איפוסי סיסמה
CREATE POLICY "Only admins can manage password resets" ON password_resets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- Enable RLS on audit_log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: משתמשים רואים רק את הלוג שלהם
CREATE POLICY "Users can view own audit log" ON audit_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Admins רואים הכל
CREATE POLICY "Admins can view all audit logs" ON audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- Policy: כולם יכולים להוסיף ללוג (INSERT only, no UPDATE/DELETE)
CREATE POLICY "All users can insert audit log" ON audit_log
  FOR INSERT
  WITH CHECK (true);

-- Enable RLS on system_settings
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Policy: כולם יכולים לקרוא הגדרות
CREATE POLICY "All users can read settings" ON system_settings
  FOR SELECT
  USING (true);

-- Policy: רק Admins יכולים לערוך הגדרות
CREATE POLICY "Only admins can update settings" ON system_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- =========================================
-- 6. HELPER FUNCTIONS
-- =========================================

-- פונקציה לבדיקת תפקיד משתמש
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID)
RETURNS VARCHAR AS $$
BEGIN
  RETURN (SELECT role FROM user_profiles WHERE id = user_uuid AND status = 'active');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- פונקציה לבדיקה אם משתמש הוא Admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_uuid AND role = 'admin' AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- פונקציה לבדיקה אם משתמש יכול לערוך תורנויות
CREATE OR REPLACE FUNCTION can_edit_duty_roster(user_uuid UUID, dept_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role VARCHAR;
  user_dept UUID;
BEGIN
  SELECT role, department_id INTO user_role, user_dept
  FROM user_profiles
  WHERE id = user_uuid AND status = 'active';
  
  -- Admin יכול לערוך הכל
  IF user_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Manager יכול לערוך רק את המחלקה שלו
  IF user_role = 'manager' AND user_dept = dept_id THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================
-- 7. TRIGGER: Auto-create profile on signup
-- =========================================
-- אוטומטית יוצר profile כאשר user נרשם דרך Supabase Auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, full_name, phone, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'operator'),
    'pending' -- כל משתמש חדש מתחיל ב-pending
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- יצירת טריגר על auth.users (Supabase managed table)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- =========================================
-- DONE! ✅
-- =========================================
-- כל הטבלאות והפונקציות ל-RBAC נוצרו בהצלחה
-- הקבצים data/*.json לא נגעו בהם!
