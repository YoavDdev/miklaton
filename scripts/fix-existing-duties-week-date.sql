-- Fix existing duty_roster records to have current week's start date
-- This ensures all existing duties appear in the current week view

-- Step 1: Show current date info
SELECT 
  'Today: ' || CURRENT_DATE::text || 
  ' | Current Week Start (Sunday): ' || 
  (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)::text AS info;

-- Step 2: Update ALL existing records to the current week
-- This assumes all your current duties are for this week
UPDATE duty_roster 
SET week_start_date = (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)
WHERE week_start_date IS NULL 
   OR week_start_date != (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER);

-- Step 3: Verify the update
SELECT 
  'Total duties updated to current week: ' || COUNT(*)::text AS result
FROM duty_roster
WHERE week_start_date = (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER);

-- Step 4: Show all duties with their week assignment
SELECT 
  dr.id,
  c.full_name AS contact_name,
  d.name AS department_name,
  dr.day_of_week,
  dr.start_hour || ':00 - ' || dr.end_hour || ':00' AS shift_hours,
  dr.week_start_date,
  CASE 
    WHEN dr.week_start_date = (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) 
    THEN '✓ Current Week'
    ELSE '⚠ Different Week'
  END AS status
FROM duty_roster dr
LEFT JOIN contacts c ON dr.contact_id = c.id
LEFT JOIN departments d ON dr.department_id = d.id
ORDER BY dr.week_start_date DESC, dr.day_of_week, dr.start_hour;
