-- Script to check duty_roster dates and week_start_date values
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Check if week_start_date column exists and what values it has
SELECT 
  'Current date: ' || CURRENT_DATE::text AS info
UNION ALL
SELECT 
  'Current week start (Sunday): ' || (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)::text AS info;

-- 2. Check all duty_roster records with their week_start_date
SELECT 
  id,
  department_id,
  contact_id,
  day_of_week,
  start_hour,
  end_hour,
  week_start_date,
  CASE 
    WHEN week_start_date IS NULL THEN 'NULL - NOT UPDATED!'
    WHEN week_start_date = (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) THEN 'Current Week ✓'
    ELSE 'Different Week (' || week_start_date::text || ')'
  END as week_status
FROM duty_roster
ORDER BY week_start_date DESC NULLS FIRST, day_of_week;

-- 3. Count records by week
SELECT 
  week_start_date,
  COUNT(*) as total_duties,
  MIN(day_of_week) as first_day,
  MAX(day_of_week) as last_day
FROM duty_roster
GROUP BY week_start_date
ORDER BY week_start_date DESC NULLS FIRST;

-- 4. Show records that should be visible this week
SELECT 
  dr.id,
  c.full_name,
  dr.day_of_week,
  dr.start_hour,
  dr.end_hour,
  dr.week_start_date
FROM duty_roster dr
LEFT JOIN contacts c ON dr.contact_id = c.id
WHERE dr.week_start_date = (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER)
ORDER BY dr.day_of_week, dr.start_hour;
