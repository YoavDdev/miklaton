-- Create panic_buttons table for emergency button locations
CREATE TABLE IF NOT EXISTS panic_buttons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'other',
  address TEXT NOT NULL,
  directions TEXT,
  contacts JSONB NOT NULL DEFAULT '[]',
  operator_instructions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  municipality_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_panic_buttons_name ON panic_buttons(name);
CREATE INDEX IF NOT EXISTS idx_panic_buttons_category ON panic_buttons(category);
CREATE INDEX IF NOT EXISTS idx_panic_buttons_is_active ON panic_buttons(is_active);
CREATE INDEX IF NOT EXISTS idx_panic_buttons_municipality ON panic_buttons(municipality_id);

-- Enable RLS
ALTER TABLE panic_buttons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on panic_buttons" ON panic_buttons
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_panic_buttons_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_panic_buttons_timestamp
  BEFORE UPDATE ON panic_buttons
  FOR EACH ROW
  EXECUTE FUNCTION update_panic_buttons_timestamp();

