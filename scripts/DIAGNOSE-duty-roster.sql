-- DIAGNOSTIC: Check duty_roster table structure and data
-- Run this FIRST to understand the current state

-- 1. Check if week_start_date column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'duty_roster'
ORDER BY ordinal_position;

-- 2. Count total duties in the table
SELECT COUNT(*) as total_duties FROM duty_roster;

-- 3. Show ALL duty records (limit 50)
SELECT 
  dr.id,
  dr.department_id,
  c.full_name as contact_name,
  dr.day_of_week,
  dr.start_hour,
  dr.end_hour,
  dr.week_start_date,
  dr.created_at
FROM duty_roster dr
LEFT JOIN contacts c ON dr.contact_id = c.id
ORDER BY dr.created_at DESC
LIMIT 50;

-- 4. Show current date and what week_start should be
SELECT 
  CURRENT_DATE as today,
  EXTRACT(DOW FROM CURRENT_DATE) as day_of_week_number,
  CASE EXTRACT(DOW FROM CURRENT_DATE)
    WHEN 0 THEN 'ראשון'
    WHEN 1 THEN 'שני'
    WHEN 2 THEN 'שלישי'
    WHEN 3 THEN 'רביעי'
    WHEN 4 THEN 'חמישי'
    WHEN 5 THEN 'שישי'
    WHEN 6 THEN 'שבת'
  END as day_name,
  (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) as this_week_start_should_be;
