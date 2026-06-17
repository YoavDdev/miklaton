-- Seed departments for Yehud-Monosson
-- Note: Municipality 'yehud' already exists in DB

-- Get municipality ID and insert departments
DO $$
DECLARE
  v_municipality_id UUID;
BEGIN
  -- Get Yehud municipality ID
  SELECT id INTO v_municipality_id FROM municipalities WHERE code = 'yehud' LIMIT 1;
  
  -- Insert departments if they don't exist
  INSERT INTO departments (municipality_id, name, display_order, active) VALUES
  (v_municipality_id, 'חשמל', 1, true),
  (v_municipality_id, 'מים', 2, true),
  (v_municipality_id, 'ביוב', 3, true),
  (v_municipality_id, 'זבל', 4, true),
  (v_municipality_id, 'כבישים', 5, true),
  (v_municipality_id, 'גינון', 6, true),
  (v_municipality_id, 'רווחה', 7, true),
  (v_municipality_id, 'חינוך', 8, true),
  (v_municipality_id, 'ביטחון', 9, true)
  ON CONFLICT DO NOTHING;
END $$;
