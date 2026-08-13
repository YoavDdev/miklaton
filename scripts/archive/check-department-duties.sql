-- Check which department the current duties belong to
-- This will help us understand if there's a department_id mismatch

SELECT 
  dr.department_id,
  d.name as department_name,
  COUNT(*) as total_duties,
  MIN(dr.week_start_date) as earliest_week,
  MAX(dr.week_start_date) as latest_week
FROM duty_roster dr
LEFT JOIN departments d ON dr.department_id = d.id
WHERE dr.week_start_date = '2026-03-22'
GROUP BY dr.department_id, d.name
ORDER BY total_duties DESC;

-- Show a few sample duties with their department info
SELECT 
  dr.id,
  dr.department_id,
  d.name as department_name,
  c.full_name as contact_name,
  dr.day_of_week,
  dr.start_hour,
  dr.end_hour,
  dr.week_start_date
FROM duty_roster dr
LEFT JOIN departments d ON dr.department_id = d.id
LEFT JOIN contacts c ON dr.contact_id = c.id
WHERE dr.week_start_date = '2026-03-22'
LIMIT 10;
