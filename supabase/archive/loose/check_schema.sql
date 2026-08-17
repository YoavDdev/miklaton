-- ============================================
-- Check Current Database Schema
-- ============================================

-- 1. Check departments table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'departments'
ORDER BY ordinal_position;

-- 2. Check on_call_contacts table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'on_call_contacts'
ORDER BY ordinal_position;

-- 3. Check on_call_shifts table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'on_call_shifts'
ORDER BY ordinal_position;

-- 4. Check contacts table structure (old)
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'contacts'
ORDER BY ordinal_position;

-- 5. Check duty_roster table structure (old)
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'duty_roster'
ORDER BY ordinal_position;

-- 6. Count records
SELECT 
  'departments' as table_name,
  COUNT(*) as records
FROM departments
UNION ALL
SELECT 
  'contacts',
  COUNT(*)
FROM contacts
UNION ALL
SELECT 
  'on_call_contacts',
  COUNT(*)
FROM on_call_contacts
UNION ALL
SELECT 
  'on_call_shifts',
  COUNT(*)
FROM on_call_shifts
UNION ALL
SELECT 
  'duty_roster',
  COUNT(*)
FROM duty_roster;
