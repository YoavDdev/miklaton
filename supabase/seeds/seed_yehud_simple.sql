-- Simple seed for Yehud municipality and departments
-- Safe version - uses existing municipality or creates new one

DO $$
DECLARE
  v_municipality_id UUID;
BEGIN
  -- Get or create Yehud municipality
  INSERT INTO municipalities (name, code, active)
  VALUES ('יהוד-מונוסון', 'yehud', true)
  ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name,
    active = EXCLUDED.active
  RETURNING id INTO v_municipality_id;
  
  -- If INSERT didn't return (conflict happened), get the existing ID
  IF v_municipality_id IS NULL THEN
    SELECT id INTO v_municipality_id FROM municipalities WHERE code = 'yehud';
  END IF;

  -- Insert departments only if they don't exist
  -- Check and insert each department individually
  INSERT INTO departments (municipality_id, name, display_order, active)
  SELECT v_municipality_id, 'חשמל', 1, true
  WHERE NOT EXISTS (SELECT 1 FROM departments WHERE municipality_id = v_municipality_id AND name = 'חשמל');
  
  INSERT INTO departments (municipality_id, name, display_order, active)
  SELECT v_municipality_id, 'מים', 2, true
  WHERE NOT EXISTS (SELECT 1 FROM departments WHERE municipality_id = v_municipality_id AND name = 'מים');
  
  INSERT INTO departments (municipality_id, name, display_order, active)
  SELECT v_municipality_id, 'ביוב', 3, true
  WHERE NOT EXISTS (SELECT 1 FROM departments WHERE municipality_id = v_municipality_id AND name = 'ביוב');
  
  INSERT INTO departments (municipality_id, name, display_order, active)
  SELECT v_municipality_id, 'זבל', 4, true
  WHERE NOT EXISTS (SELECT 1 FROM departments WHERE municipality_id = v_municipality_id AND name = 'זבל');
  
  INSERT INTO departments (municipality_id, name, display_order, active)
  SELECT v_municipality_id, 'כבישים', 5, true
  WHERE NOT EXISTS (SELECT 1 FROM departments WHERE municipality_id = v_municipality_id AND name = 'כבישים');
  
  INSERT INTO departments (municipality_id, name, display_order, active)
  SELECT v_municipality_id, 'גינון', 6, true
  WHERE NOT EXISTS (SELECT 1 FROM departments WHERE municipality_id = v_municipality_id AND name = 'גינון');
  
  INSERT INTO departments (municipality_id, name, display_order, active)
  SELECT v_municipality_id, 'רווחה', 7, true
  WHERE NOT EXISTS (SELECT 1 FROM departments WHERE municipality_id = v_municipality_id AND name = 'רווחה');
  
  INSERT INTO departments (municipality_id, name, display_order, active)
  SELECT v_municipality_id, 'חינוך', 8, true
  WHERE NOT EXISTS (SELECT 1 FROM departments WHERE municipality_id = v_municipality_id AND name = 'חינוך');
  
  INSERT INTO departments (municipality_id, name, display_order, active)
  SELECT v_municipality_id, 'ביטחון', 9, true
  WHERE NOT EXISTS (SELECT 1 FROM departments WHERE municipality_id = v_municipality_id AND name = 'ביטחון');
END $$;
