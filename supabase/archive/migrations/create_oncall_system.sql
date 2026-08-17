-- Create departments (מכלולים) table
CREATE TABLE IF NOT EXISTS departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create contacts (אנשי קשר) table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create duty roster (כוננויות) table
-- Each row represents one person on duty for a specific day and time slot
CREATE TABLE IF NOT EXISTS duty_roster (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL, -- 0=Sunday, 6=Saturday
  start_hour INTEGER NOT NULL, -- 0-23
  end_hour INTEGER NOT NULL, -- 0-23
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_day CHECK (day_of_week >= 0 AND day_of_week <= 6),
  CONSTRAINT valid_hours CHECK (start_hour >= 0 AND start_hour <= 23 AND end_hour >= 0 AND end_hour <= 23)
);

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE departments;
ALTER PUBLICATION supabase_realtime ADD TABLE contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE duty_roster;

-- Create indexes for performance
CREATE INDEX idx_contacts_department ON contacts(department_id);
CREATE INDEX idx_duty_roster_contact ON duty_roster(contact_id);
CREATE INDEX idx_duty_roster_department ON duty_roster(department_id);
CREATE INDEX idx_duty_roster_day_hour ON duty_roster(day_of_week, start_hour, end_hour);

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_oncall_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_departments_timestamp
  BEFORE UPDATE ON departments
  FOR EACH ROW
  EXECUTE FUNCTION update_oncall_timestamp();

CREATE TRIGGER update_contacts_timestamp
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_oncall_timestamp();

CREATE TRIGGER update_duty_roster_timestamp
  BEFORE UPDATE ON duty_roster
  FOR EACH ROW
  EXECUTE FUNCTION update_oncall_timestamp();
