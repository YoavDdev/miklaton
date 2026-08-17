-- ============================================
-- Migration: Add Daily Operations Features
-- Date: 2026-05-10
-- Description: Add municipalities, daily updates, and enhance existing tables
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. MUNICIPALITIES (Multi-tenant support)
-- ============================================
CREATE TABLE IF NOT EXISTS municipalities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Yehud as default municipality
INSERT INTO municipalities (name, code, settings) VALUES
  ('יהוד-מונוסון', 'yehud', '{"timezone": "Asia/Jerusalem", "language": "he"}')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 2. ADD municipality_id TO EXISTING TABLES
-- ============================================

-- Add to user_profiles
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'municipality_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN municipality_id UUID;
    
    -- Set all existing users to Yehud
    UPDATE user_profiles 
    SET municipality_id = (SELECT id FROM municipalities WHERE code = 'yehud');
    
    -- Add foreign key
    ALTER TABLE user_profiles
    ADD CONSTRAINT fk_user_profiles_municipality 
    FOREIGN KEY (municipality_id) REFERENCES municipalities(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add to departments
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'departments' AND column_name = 'municipality_id'
  ) THEN
    ALTER TABLE departments ADD COLUMN municipality_id UUID;
    
    -- Set all existing departments to Yehud
    UPDATE departments 
    SET municipality_id = (SELECT id FROM municipalities WHERE code = 'yehud');
    
    -- Add foreign key
    ALTER TABLE departments
    ADD CONSTRAINT fk_departments_municipality 
    FOREIGN KEY (municipality_id) REFERENCES municipalities(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add to operator_tasks
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'operator_tasks' AND column_name = 'municipality_id'
  ) THEN
    ALTER TABLE operator_tasks ADD COLUMN municipality_id UUID;
    
    -- Set all existing tasks to Yehud
    UPDATE operator_tasks 
    SET municipality_id = (SELECT id FROM municipalities WHERE code = 'yehud');
    
    -- Add foreign key
    ALTER TABLE operator_tasks
    ADD CONSTRAINT fk_operator_tasks_municipality 
    FOREIGN KEY (municipality_id) REFERENCES municipalities(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 3. ON-CALL CONTACTS (new table)
-- ============================================
CREATE TABLE IF NOT EXISTS on_call_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  municipality_id UUID REFERENCES municipalities(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100),
  is_external BOOLEAN DEFAULT false,
  external_company VARCHAR(100),
  is_default BOOLEAN DEFAULT false,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_on_call_contacts_dept ON on_call_contacts(department_id);
CREATE INDEX IF NOT EXISTS idx_on_call_contacts_active ON on_call_contacts(municipality_id, active);
CREATE INDEX IF NOT EXISTS idx_on_call_contacts_default ON on_call_contacts(department_id, is_default) WHERE is_default = true;

-- ============================================
-- 4. ENHANCE on_call_shifts (if exists)
-- ============================================
-- Add new columns to existing on_call_shifts table
DO $$ 
BEGIN
  -- Add contact_id if doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'on_call_shifts' AND column_name = 'contact_id'
  ) THEN
    ALTER TABLE on_call_shifts ADD COLUMN contact_id UUID REFERENCES on_call_contacts(id) ON DELETE CASCADE;
  END IF;
  
  -- Add shift_type if doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'on_call_shifts' AND column_name = 'shift_type'
  ) THEN
    ALTER TABLE on_call_shifts ADD COLUMN shift_type VARCHAR(20) DEFAULT 'both';
  END IF;
  
  -- Add reason if doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'on_call_shifts' AND column_name = 'reason'
  ) THEN
    ALTER TABLE on_call_shifts ADD COLUMN reason VARCHAR(200);
  END IF;
END $$;

-- ============================================
-- 5. DAILY UPDATES (new table)
-- ============================================
CREATE TABLE IF NOT EXISTS daily_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  municipality_id UUID REFERENCES municipalities(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL,
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

-- Index for active updates (without NOW() in predicate - not immutable)
CREATE INDEX IF NOT EXISTS idx_daily_updates_active 
  ON daily_updates(municipality_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_daily_updates_history 
  ON daily_updates(municipality_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_updates_location 
  ON daily_updates(municipality_id, lat, lng) 
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- ============================================
-- 6. SHIFT MESSAGES (new table)
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
-- 7. OPERATOR SHIFTS (new table)
-- ============================================
CREATE TABLE IF NOT EXISTS operator_shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  municipality_id UUID REFERENCES municipalities(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  shift_type VARCHAR(20) NOT NULL,
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
-- 8. UPDATE TRIGGERS
-- ============================================

-- Trigger for municipalities
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_municipalities_updated_at BEFORE UPDATE ON municipalities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_on_call_contacts_updated_at BEFORE UPDATE ON on_call_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_daily_updates_updated_at BEFORE UPDATE ON daily_updates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_operator_shifts_updated_at BEFORE UPDATE ON operator_shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 9. ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE on_call_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_shifts ENABLE ROW LEVEL SECURITY;

-- Simple policies - allow all for authenticated users
CREATE POLICY "Allow all for authenticated users" ON municipalities
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON on_call_contacts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON daily_updates
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON shift_messages
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON operator_shifts
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 10. HELPER FUNCTIONS
-- ============================================

-- Get current on-call contact for a department
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

-- Get active daily updates
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
-- MIGRATION COMPLETE ✅
-- ============================================
