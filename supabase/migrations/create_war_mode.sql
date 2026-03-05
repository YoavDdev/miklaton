-- Create war_mode table for global emergency status
CREATE TABLE IF NOT EXISTS war_mode (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT false,
  activated_at TIMESTAMPTZ,
  activated_by TEXT,
  deactivated_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert initial row (only one row will exist)
INSERT INTO war_mode (is_active) VALUES (false)
ON CONFLICT DO NOTHING;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE war_mode;

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_war_mode_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_war_mode_timestamp
  BEFORE UPDATE ON war_mode
  FOR EACH ROW
  EXECUTE FUNCTION update_war_mode_timestamp();
