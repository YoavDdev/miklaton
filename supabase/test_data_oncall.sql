-- ============================================
-- Test Data: On-Call Contacts
-- ============================================
-- נתוני בדיקה לכוננים - להריץ אחרי ה-migration

-- Get municipality and department IDs
DO $$
DECLARE
  yehud_id UUID;
  dept_id UUID;
  contact_id UUID;
BEGIN
  -- Get Yehud municipality ID
  SELECT id INTO yehud_id FROM municipalities WHERE code = 'yehud';
  
  IF yehud_id IS NULL THEN
    RAISE EXCEPTION 'Municipality yehud not found';
  END IF;

  -- ============================================
  -- Add on-call contacts for existing departments
  -- ============================================
  
  -- Loop through all departments and add sample contacts
  FOR dept_id IN 
    SELECT id FROM departments WHERE active = true
  LOOP
    -- Check if department already has a contact
    IF NOT EXISTS (
      SELECT 1 FROM on_call_contacts 
      WHERE department_id = dept_id
    ) THEN
      -- Insert a sample contact
      INSERT INTO on_call_contacts (
        municipality_id,
        department_id,
        name,
        phone,
        is_default,
        active
      ) VALUES (
        yehud_id,
        dept_id,
        'כונן ' || (SELECT name FROM departments WHERE id = dept_id),
        '050-' || LPAD(floor(random() * 10000000)::text, 7, '0'),
        true,
        true
      ) RETURNING id INTO contact_id;
      
      -- Add a permanent shift for this contact
      INSERT INTO on_call_shifts (
        contact_id,
        department_id,
        shift_type,
        start_date
      ) VALUES (
        contact_id,
        dept_id,
        'both', -- weekday + weekend
        CURRENT_DATE
      );
      
      RAISE NOTICE 'Added contact for department: %', (SELECT name FROM departments WHERE id = dept_id);
    END IF;
  END LOOP;

END $$;

-- ============================================
-- Verify the data
-- ============================================
SELECT 
  d.name as department,
  oc.name as contact_name,
  oc.phone,
  oc.is_default,
  os.shift_type,
  os.start_date
FROM departments d
LEFT JOIN on_call_contacts oc ON oc.department_id = d.id
LEFT JOIN on_call_shifts os ON os.contact_id = oc.id
WHERE d.active = true
ORDER BY d.name;
