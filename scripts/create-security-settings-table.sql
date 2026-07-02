-- Security Department Settings - הגדרות מכלול בטחון
-- Stores configurable lists: vehicles, task templates per role
CREATE TABLE IF NOT EXISTS security_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL, -- 'vehicles', 'tasks_pikuach', 'tasks_shitur'
  setting_value JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(department_id, setting_key)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_security_settings_dept ON security_settings(department_id, setting_key);

-- RLS
ALTER TABLE security_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON security_settings FOR ALL USING (true);

-- Default seed (optional - will be created by the app on first use)
