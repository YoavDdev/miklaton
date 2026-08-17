-- ============================================
-- Migration: Enhance On-Call Shifts System
-- Date: 2026-05-11
-- Description: Add support for specific days and time ranges
-- ============================================

-- Add new columns to on_call_shifts table
DO $$ 
BEGIN
  -- Add start_date if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'on_call_shifts' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE on_call_shifts ADD COLUMN start_date DATE;
    COMMENT ON COLUMN on_call_shifts.start_date IS 'תאריך התחלה - NULL = מיד';
  END IF;

  -- Add end_date if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'on_call_shifts' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE on_call_shifts ADD COLUMN end_date DATE;
    COMMENT ON COLUMN on_call_shifts.end_date IS 'תאריך סיום - NULL = ללא הגבלה';
  END IF;

  -- Add days_of_week (JSON array of day numbers: 0=Sunday, 6=Saturday)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'on_call_shifts' AND column_name = 'days_of_week'
  ) THEN
    ALTER TABLE on_call_shifts ADD COLUMN days_of_week JSONB DEFAULT '[0,1,2,3,4,5,6]';
    COMMENT ON COLUMN on_call_shifts.days_of_week IS 'ימים בשבוע - מערך של מספרים: 0=ראשון, 6=שבת. דוגמה: [0,1,2,3,4] = א-ה';
  END IF;

  -- Add time_start (NULL = כל היום)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'on_call_shifts' AND column_name = 'time_start'
  ) THEN
    ALTER TABLE on_call_shifts ADD COLUMN time_start TIME;
    COMMENT ON COLUMN on_call_shifts.time_start IS 'שעת התחלה - NULL = כל היום. דוגמה: 08:00';
  END IF;

  -- Add time_end (NULL = כל היום)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'on_call_shifts' AND column_name = 'time_end'
  ) THEN
    ALTER TABLE on_call_shifts ADD COLUMN time_end TIME;
    COMMENT ON COLUMN on_call_shifts.time_end IS 'שעת סיום - NULL = כל היום. דוגמה: 20:00';
  END IF;

  -- Add description
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'on_call_shifts' AND column_name = 'description'
  ) THEN
    ALTER TABLE on_call_shifts ADD COLUMN description TEXT;
    COMMENT ON COLUMN on_call_shifts.description IS 'תיאור המשמרת - למשל "משמרת יום" או "כוננות שבת"';
  END IF;

END $$;

-- Create improved function to get current on-call contact
CREATE OR REPLACE FUNCTION get_current_on_call_v2(
  p_department_id UUID,
  p_check_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  contact_id UUID,
  contact_name VARCHAR(100),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(100),
  role_description TEXT,
  priority INTEGER,
  escalation_instructions TEXT,
  fallback_contact_id UUID,
  fallback_name VARCHAR(100),
  fallback_phone VARCHAR(20),
  notes TEXT,
  available_hours VARCHAR(50),
  is_external BOOLEAN,
  external_company VARCHAR(100),
  shift_description TEXT,
  shift_type VARCHAR(20)
) AS $$
DECLARE
  v_day_of_week INTEGER;
  v_time_of_day TIME;
BEGIN
  -- Get current day of week (0=Sunday, 6=Saturday)
  v_day_of_week := EXTRACT(DOW FROM p_check_time);
  
  -- Get current time
  v_time_of_day := p_check_time::TIME;
  
  RETURN QUERY
  SELECT 
    oc.id,
    oc.name,
    oc.phone,
    oc.email,
    oc.role_description,
    oc.priority,
    oc.escalation_instructions,
    oc.fallback_contact_id,
    fb.name AS fallback_name,
    fb.phone AS fallback_phone,
    oc.notes,
    oc.available_hours,
    oc.is_external,
    oc.external_company,
    os.description AS shift_description,
    os.shift_type
  FROM on_call_contacts oc
  INNER JOIN on_call_shifts os ON os.contact_id = oc.id
  LEFT JOIN on_call_contacts fb ON fb.id = oc.fallback_contact_id
  WHERE oc.department_id = p_department_id
    AND oc.active = true
    -- Check date range
    AND (os.start_date IS NULL OR os.start_date <= p_check_time::DATE)
    AND (os.end_date IS NULL OR os.end_date >= p_check_time::DATE)
    -- Check day of week
    AND os.days_of_week @> to_jsonb(v_day_of_week)
    -- Check time range (NULL = all day)
    AND (
      (os.time_start IS NULL AND os.time_end IS NULL) -- All day
      OR (
        os.time_start IS NOT NULL 
        AND os.time_end IS NOT NULL
        AND (
          -- Normal time range (e.g., 08:00-20:00)
          (os.time_start < os.time_end AND v_time_of_day >= os.time_start AND v_time_of_day < os.time_end)
          OR
          -- Overnight range (e.g., 20:00-08:00)
          (os.time_start > os.time_end AND (v_time_of_day >= os.time_start OR v_time_of_day < os.time_end))
        )
      )
    )
  ORDER BY 
    -- Temporary shifts have priority
    CASE WHEN os.shift_type = 'temporary' THEN 0 ELSE 1 END,
    -- Then by contact priority
    oc.priority ASC,
    -- Then by creation date
    oc.created_at ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_current_on_call_v2 IS 'מחזיר את הכונן הפעיל כרגע - תומך בימים, שעות, ומשמרות זמניות';

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_current_on_call_v2 TO authenticated;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_on_call_shifts_days 
  ON on_call_shifts USING GIN (days_of_week);

CREATE INDEX IF NOT EXISTS idx_on_call_shifts_dates 
  ON on_call_shifts(start_date, end_date);
