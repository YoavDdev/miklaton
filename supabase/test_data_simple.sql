-- ============================================
-- Simple Test Data - Manual Insert
-- ============================================
-- הוספה ידנית של כוננים לבדיקה

-- Step 1: Get IDs (copy these for next steps)
SELECT 
  'Municipality ID:' as label,
  id as value,
  name
FROM municipalities 
WHERE code = 'yehud';

SELECT 
  'Department IDs:' as label,
  id as value,
  name
FROM departments 
WHERE active = true
ORDER BY name;

-- ============================================
-- Step 2: Insert contacts (replace UUIDs below)
-- ============================================

-- Example: Add contact for first department
-- REPLACE 'YOUR_MUNICIPALITY_ID' and 'YOUR_DEPARTMENT_ID' with actual UUIDs from above

/*
INSERT INTO on_call_contacts (
  municipality_id,
  department_id,
  name,
  phone,
  email,
  is_default,
  active
) VALUES (
  'YOUR_MUNICIPALITY_ID',  -- Replace with actual municipality ID
  'YOUR_DEPARTMENT_ID',     -- Replace with actual department ID
  'מאור אייש',
  '050-1234567',
  'maor@example.com',
  true,
  true
);

-- Get the contact ID that was just created
SELECT id, name FROM on_call_contacts ORDER BY created_at DESC LIMIT 1;

-- Add a shift for this contact
INSERT INTO on_call_shifts (
  contact_id,
  department_id,
  shift_type,
  start_date
) VALUES (
  'YOUR_CONTACT_ID',        -- Replace with contact ID from above
  'YOUR_DEPARTMENT_ID',     -- Same department ID as above
  'both',                   -- weekday + weekend
  CURRENT_DATE
);
*/

-- ============================================
-- Step 3: Verify
-- ============================================
SELECT 
  d.name as "מחלקה",
  oc.name as "כונן",
  oc.phone as "טלפון",
  CASE WHEN oc.is_default THEN 'כן' ELSE 'לא' END as "קבוע",
  os.shift_type as "סוג משמרת",
  os.start_date as "תאריך התחלה"
FROM departments d
LEFT JOIN on_call_contacts oc ON oc.department_id = d.id
LEFT JOIN on_call_shifts os ON os.contact_id = oc.id
WHERE d.active = true
ORDER BY d.name;
