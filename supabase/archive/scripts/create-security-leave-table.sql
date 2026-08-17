-- Security Staff Leave / Vacation - חופשות עובדי ביטחון
CREATE TABLE IF NOT EXISTS security_staff_leave (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES security_staff(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT, -- חופשה / מחלה / מילואים / אחר
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_security_leave_dept ON security_staff_leave(department_id);
CREATE INDEX IF NOT EXISTS idx_security_leave_staff ON security_staff_leave(staff_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_security_leave_dates ON security_staff_leave(start_date, end_date);

-- RLS
ALTER TABLE security_staff_leave ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON security_staff_leave FOR ALL USING (true);
