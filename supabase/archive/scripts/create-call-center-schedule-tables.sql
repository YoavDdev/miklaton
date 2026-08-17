-- Call Center Staff, Shifts, and Schedule Tables
-- For managing call center representative shifts and schedules

-- Call Center Staff - נציגי שירות
CREATE TABLE IF NOT EXISTS call_center_staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL, -- אחמ"ש / נציג
  phone TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Call Center Shifts - משמרות
CREATE TABLE IF NOT EXISTS call_center_shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- בוקר / ביניים / ערב
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Call Center Weekly Schedule - סידור עבודה שבועי
CREATE TABLE IF NOT EXISTS call_center_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES call_center_shifts(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES call_center_staff(id) ON DELETE SET NULL,
  staff_name TEXT, -- שם ידני לעובד שאינו ברשימה (עובד חדש/זמני)
  week_start DATE NOT NULL, -- תאריך תחילת שבוע (יום ראשון)
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=ראשון, 6=שבת
  position TEXT, -- אחמ"ש / נציג / ביניים
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_call_center_staff_dept ON call_center_staff(department_id);
CREATE INDEX IF NOT EXISTS idx_call_center_shifts_dept ON call_center_shifts(department_id);
CREATE INDEX IF NOT EXISTS idx_call_center_schedule_week ON call_center_schedule(department_id, week_start);
CREATE INDEX IF NOT EXISTS idx_call_center_schedule_day ON call_center_schedule(shift_id, week_start, day_of_week);

-- RLS Policies
ALTER TABLE call_center_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_center_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_center_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON call_center_staff FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON call_center_shifts FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON call_center_schedule FOR ALL USING (true);

-- Insert default shifts
INSERT INTO call_center_shifts (department_id, name, start_time, end_time)
SELECT 
  d.id,
  shift_name,
  shift_start::TIME,
  shift_end::TIME
FROM departments d
CROSS JOIN (
  VALUES 
    ('בוקר', '07:00', '15:00'),
    ('ביניים', '11:00', '19:00'),
    ('ערב', '15:00', '23:00')
) AS shifts(shift_name, shift_start, shift_end)
WHERE d.name = 'מוקד 106'
ON CONFLICT DO NOTHING;
