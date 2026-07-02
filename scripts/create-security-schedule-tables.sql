-- Security Staff - עובדי מכלול בטחון
CREATE TABLE IF NOT EXISTS security_staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'פיקוח', -- פיקוח / שיטור
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security Shift Types - סוגי משמרות
CREATE TABLE IF NOT EXISTS security_shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'פיקוח', -- פיקוח / שיטור
  name TEXT NOT NULL, -- שם המשמרת (כוננות, פיקוח, הנמלאות בוקר...)
  start_time TEXT NOT NULL, -- "06:30"
  end_time TEXT NOT NULL, -- "15:00"
  display_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security Weekly Schedule - סידור עבודה שבועי
CREATE TABLE IF NOT EXISTS security_weekly_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES security_shifts(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES security_staff(id) ON DELETE SET NULL,
  week_start DATE NOT NULL, -- תאריך תחילת שבוע (יום ראשון)
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=ראשון, 6=שבת
  is_backup BOOLEAN DEFAULT false, -- האם חלופי
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_security_staff_dept ON security_staff(department_id);
CREATE INDEX IF NOT EXISTS idx_security_shifts_dept ON security_shifts(department_id);
CREATE INDEX IF NOT EXISTS idx_security_schedule_week ON security_weekly_schedule(department_id, week_start);
CREATE INDEX IF NOT EXISTS idx_security_schedule_shift ON security_weekly_schedule(shift_id, week_start, day_of_week);

-- RLS Policies
ALTER TABLE security_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_weekly_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON security_staff FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON security_shifts FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON security_weekly_schedule FOR ALL USING (true);
