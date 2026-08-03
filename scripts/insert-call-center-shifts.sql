-- Insert default shifts for call center
-- Run this if the automatic insert didn't work

-- First, get the department ID
DO $$
DECLARE
  dept_id UUID;
BEGIN
  -- Find מוקד 106 department
  SELECT id INTO dept_id FROM departments WHERE name LIKE '%מוקד%' LIMIT 1;
  
  IF dept_id IS NOT NULL THEN
    -- Insert shifts if they don't exist
    INSERT INTO call_center_shifts (department_id, name, start_time, end_time)
    VALUES 
      (dept_id, 'בוקר', '07:00', '15:00'),
      (dept_id, 'ביניים', '11:00', '19:00'),
      (dept_id, 'ערב', '15:00', '23:00')
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Shifts inserted for department: %', dept_id;
  ELSE
    RAISE NOTICE 'Department "מוקד" not found!';
  END IF;
END $$;

-- Verify shifts were created
SELECT d.name as department, s.name as shift_name, s.start_time, s.end_time
FROM call_center_shifts s
JOIN departments d ON s.department_id = d.id
ORDER BY s.start_time;
