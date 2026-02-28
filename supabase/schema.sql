-- Create shelter_status table for tracking public shelter open/closed status
CREATE TABLE IF NOT EXISTS shelter_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shelter_number VARCHAR(20) NOT NULL UNIQUE,
  is_open BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by VARCHAR(100) DEFAULT 'מוקדן',
  CONSTRAINT shelter_number_unique UNIQUE (shelter_number)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_shelter_status_number ON shelter_status(shelter_number);
CREATE INDEX IF NOT EXISTS idx_shelter_status_updated_at ON shelter_status(updated_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE shelter_status ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (since this is internal operator system)
CREATE POLICY "Allow all operations on shelter_status" ON shelter_status
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shelter_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
CREATE TRIGGER set_shelter_status_timestamp
  BEFORE UPDATE ON shelter_status
  FOR EACH ROW
  EXECUTE FUNCTION update_shelter_status_timestamp();

-- Insert initial records for all public shelters (all closed by default)
INSERT INTO shelter_status (shelter_number, is_open, updated_by) VALUES
  ('309', false, 'system'),
  ('1001', false, 'system'),
  ('1002', false, 'system'),
  ('1003', false, 'system'),
  ('1004', false, 'system'),
  ('1005', false, 'system'),
  ('1006', false, 'system'),
  ('1007', false, 'system'),
  ('1008', false, 'system'),
  ('1009', false, 'system'),
  ('1010', false, 'system'),
  ('1011', false, 'system'),
  ('1012', false, 'system'),
  ('1013', false, 'system'),
  ('1014', false, 'system'),
  ('1015', false, 'system'),
  ('1016', false, 'system'),
  ('1017', false, 'system'),
  ('1018', false, 'system'),
  ('1019', false, 'system'),
  ('1020', false, 'system'),
  ('1021', false, 'system'),
  ('1022', false, 'system'),
  ('1023', false, 'system'),
  ('1024', false, 'system')
ON CONFLICT (shelter_number) DO NOTHING;

-- Create general_notifications table for operator announcements and guidelines
CREATE TABLE IF NOT EXISTS general_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'info', -- info, warning, urgent
  author VARCHAR(100) NOT NULL DEFAULT 'מוקדן',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_general_notifications_created_at ON general_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_general_notifications_type ON general_notifications(type);

-- Enable Row Level Security (RLS)
ALTER TABLE general_notifications ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
CREATE POLICY "Allow all operations on general_notifications" ON general_notifications
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_general_notifications_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
CREATE TRIGGER set_general_notifications_timestamp
  BEFORE UPDATE ON general_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_general_notifications_timestamp();
