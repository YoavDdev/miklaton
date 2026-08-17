-- ============================================
-- Migration: Daily Operations System
-- Date: 2026-05-10
-- Description: Multi-tenant support, daily updates, dynamic on-call, tasks
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 0. IMPORTANT NOTE
-- ============================================
-- This migration assumes that the following migrations have already been run:
-- 1. create_rbac_system.sql (creates user_profiles table)
-- 2. create_oncall_system.sql (creates departments table)
--
-- If user_profiles or departments don't exist yet, run those migrations first!

-- ============================================
-- 1. MUNICIPALITIES (Multi-tenant support)
-- ============================================
CREATE TABLE IF NOT EXISTS municipalities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL, -- 'yehud', 'tel_aviv', etc.
  logo_url TEXT,
  settings JSONB DEFAULT '{}', -- Custom settings per municipality
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Yehud as default municipality
INSERT INTO municipalities (name, code, settings) VALUES
  ('יהוד-מונוסון', 'yehud', '{"timezone": "Asia/Jerusalem", "language": "he"}')
ON CONFLICT (code) DO NOTHING;

-- Add municipality_id column to user_profiles if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'municipality_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN municipality_id UUID;
  END IF;
END $$;

-- Update existing users to belong to Yehud municipality
UPDATE user_profiles 
SET municipality_id = (SELECT id FROM municipalities WHERE code = 'yehud')
WHERE municipality_id IS NULL;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_user_profiles_municipality'
  ) THEN
    ALTER TABLE user_profiles
    ADD CONSTRAINT fk_user_profiles_municipality 
    FOREIGN KEY (municipality_id) REFERENCES municipalities(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- 2. DEPARTMENTS (מכלולים/מחלקות)
-- ============================================
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  municipality_id UUID REFERENCES municipalities(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL, -- 'electricity', 'sewage', 'welfare', etc.
  icon VARCHAR(10) DEFAULT '📋', -- Emoji icon
  requires_24_7 BOOLEAN DEFAULT false, -- Must have on-call 24/7
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(municipality_id, code)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_departments_municipality ON departments(municipality_id);
CREATE INDEX IF NOT EXISTS idx_departments_active ON departments(municipality_id, active);

-- Insert default departments for Yehud
INSERT INTO departments (municipality_id, name, code, icon, requires_24_7) 
SELECT 
  m.id,
  dept.name,
  dept.code,
  dept.icon,
  dept.requires_24_7
FROM municipalities m
CROSS JOIN (VALUES
  ('חשמל', 'electricity', '⚡', true),
  ('מים', 'water', '💧', true),
  ('ביוב', 'sewage', '🚰', true),
  ('זבל', 'garbage', '🗑️', false),
  ('כבישים', 'roads', '🛣️', false),
  ('גינון', 'gardening', '🌳', false),
  ('רווחה', 'welfare', '🤝', true),
  ('חינוך', 'education', '📚', false),
  ('ביטחון', 'security', '🛡️', true)
) AS dept(name, code, icon, requires_24_7)
WHERE m.code = 'yehud'
ON CONFLICT (municipality_id, code) DO NOTHING;

-- ============================================
-- 3. ON-CALL CONTACTS (אנשי קשר כוננים)
-- ============================================
CREATE TABLE IF NOT EXISTS on_call_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  municipality_id UUID REFERENCES municipalities(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100),
  is_external BOOLEAN DEFAULT false, -- חברה חיצונית?
  external_company VARCHAR(100), -- שם החברה החיצונית
  is_default BOOLEAN DEFAULT false, -- הכונן הקבוע?
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_on_call_contacts_dept ON on_call_contacts(department_id);
CREATE INDEX IF NOT EXISTS idx_on_call_contacts_active ON on_call_contacts(municipality_id, active);
CREATE INDEX IF NOT EXISTS idx_on_call_contacts_default ON on_call_contacts(department_id, is_default) WHERE is_default = true;

-- ============================================
-- 4. ON-CALL SHIFTS (משמרות כוננות)
-- ============================================
CREATE TABLE IF NOT EXISTS on_call_shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID REFERENCES on_call_contacts(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  shift_type VARCHAR(20) NOT NULL, -- 'weekday', 'weekend', 'both', 'temporary'
  start_date DATE NOT NULL,
  end_date DATE, -- NULL = indefinite (for default contacts)
  start_time TIME, -- NULL = all day
  end_time TIME,
  reason VARCHAR(200), -- "חופש", "מחלה", "החלפה זמנית"
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for "who's on call now" queries
CREATE INDEX IF NOT EXISTS idx_on_call_shifts_active 
  ON on_call_shifts(department_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_on_call_shifts_dates 
  ON on_call_shifts(start_date, end_date) WHERE end_date IS NULL OR end_date >= CURRENT_DATE;

-- ============================================
-- 5. DAILY UPDATES (עדכונים יומיומיים)
-- ============================================
CREATE TABLE IF NOT EXISTS daily_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  municipality_id UUID REFERENCES municipalities(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL, -- 'road_closure', 'event', 'maintenance', 'alert', 'other'
  address TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for active updates (most common query)
CREATE INDEX IF NOT EXISTS idx_daily_updates_active 
  ON daily_updates(municipality_id, start_time, end_time) 
  WHERE end_time > NOW();

-- Index for history queries
CREATE INDEX IF NOT EXISTS idx_daily_updates_history 
  ON daily_updates(municipality_id, created_at DESC);

-- Index for map queries
CREATE INDEX IF NOT EXISTS idx_daily_updates_location 
  ON daily_updates(municipality_id, lat, lng) 
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- ============================================
-- 6. OPERATOR TASKS (משימות מוקדנים)
-- ============================================
CREATE TABLE IF NOT EXISTS operator_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  municipality_id UUID REFERENCES municipalities(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES user_profiles(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operator_tasks_assigned 
  ON operator_tasks(assigned_to, status) WHERE status != 'completed';
CREATE INDEX IF NOT EXISTS idx_operator_tasks_municipality 
  ON operator_tasks(municipality_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operator_tasks_pending 
  ON operator_tasks(municipality_id, status) WHERE status = 'pending';

-- ============================================
-- 7. SHIFT MESSAGES (הודעות בין משמרות)
-- ============================================
CREATE TABLE IF NOT EXISTS shift_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  municipality_id UUID REFERENCES municipalities(id) ON DELETE CASCADE,
  from_user UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  to_user UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  related_task_id UUID REFERENCES operator_tasks(id) ON DELETE SET NULL,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_messages_to_user 
  ON shift_messages(to_user, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shift_messages_unread 
  ON shift_messages(to_user) WHERE read = false;

-- ============================================
-- 8. OPERATOR SHIFTS (לוח משמרות מוקדנים)
-- ============================================
CREATE TABLE IF NOT EXISTS operator_shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  municipality_id UUID REFERENCES municipalities(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  shift_type VARCHAR(20) NOT NULL, -- 'morning', 'evening', 'night'
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(operator_id, shift_date, shift_type)
);

CREATE INDEX IF NOT EXISTS idx_operator_shifts_date 
  ON operator_shifts(municipality_id, shift_date, shift_type);
CREATE INDEX IF NOT EXISTS idx_operator_shifts_operator 
  ON operator_shifts(operator_id, shift_date);

-- ============================================
-- 9. UPDATE TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp for all tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER set_municipalities_updated_at BEFORE UPDATE ON municipalities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_departments_updated_at BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_on_call_contacts_updated_at BEFORE UPDATE ON on_call_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_on_call_shifts_updated_at BEFORE UPDATE ON on_call_shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_daily_updates_updated_at BEFORE UPDATE ON daily_updates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_operator_tasks_updated_at BEFORE UPDATE ON operator_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_operator_shifts_updated_at BEFORE UPDATE ON operator_shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 10. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE on_call_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE on_call_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_shifts ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (we'll handle permissions in app logic)
CREATE POLICY "Allow all for authenticated users" ON municipalities
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON departments
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON on_call_contacts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON on_call_shifts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON daily_updates
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON operator_tasks
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON shift_messages
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON operator_shifts
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 11. HELPER FUNCTIONS
-- ============================================

-- Function to get current on-call contact for a department
CREATE OR REPLACE FUNCTION get_current_on_call(dept_id UUID, check_time TIMESTAMPTZ DEFAULT NOW())
RETURNS TABLE (
  contact_id UUID,
  contact_name VARCHAR(100),
  contact_phone VARCHAR(20),
  is_external BOOLEAN,
  external_company VARCHAR(100)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oc.id,
    oc.name,
    oc.phone,
    oc.is_external,
    oc.external_company
  FROM on_call_contacts oc
  INNER JOIN on_call_shifts os ON os.contact_id = oc.id
  WHERE os.department_id = dept_id
    AND oc.active = true
    AND os.start_date <= check_time::DATE
    AND (os.end_date IS NULL OR os.end_date >= check_time::DATE)
    AND (
      os.start_time IS NULL 
      OR (check_time::TIME >= os.start_time AND check_time::TIME <= os.end_time)
    )
  ORDER BY 
    CASE WHEN os.shift_type = 'temporary' THEN 1 ELSE 2 END,
    os.created_at DESC
  LIMIT 1;
  
  -- If no active shift, return default contact
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      oc.id,
      oc.name,
      oc.phone,
      oc.is_external,
      oc.external_company
    FROM on_call_contacts oc
    WHERE oc.department_id = dept_id
      AND oc.active = true
      AND oc.is_default = true
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get active daily updates
CREATE OR REPLACE FUNCTION get_active_daily_updates(muni_id UUID, check_time TIMESTAMPTZ DEFAULT NOW())
RETURNS TABLE (
  id UUID,
  title VARCHAR(200),
  description TEXT,
  type VARCHAR(50),
  address TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  time_remaining INTERVAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    du.id,
    du.title,
    du.description,
    du.type,
    du.address,
    du.lat,
    du.lng,
    du.start_time,
    du.end_time,
    (du.end_time - check_time) AS time_remaining
  FROM daily_updates du
  WHERE du.municipality_id = muni_id
    AND du.start_time <= check_time
    AND du.end_time > check_time
  ORDER BY du.start_time ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
