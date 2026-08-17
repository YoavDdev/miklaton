-- Migration: Enhance Call Categories with Availability & Vacation Management
-- Description: Add fields for time-based availability, vacation tracking, and temporary unavailability
-- Date: 2026-05-11

-- ============================================
-- Add availability fields to call_category_contacts
-- ============================================

-- Days of week availability (0=Sunday, 6=Saturday)
ALTER TABLE call_category_contacts 
ADD COLUMN IF NOT EXISTS available_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6];

-- Time range availability
ALTER TABLE call_category_contacts 
ADD COLUMN IF NOT EXISTS available_hours_start TIME DEFAULT NULL;

ALTER TABLE call_category_contacts 
ADD COLUMN IF NOT EXISTS available_hours_end TIME DEFAULT NULL;

-- Vacation/Leave management
ALTER TABLE call_category_contacts 
ADD COLUMN IF NOT EXISTS on_vacation BOOLEAN DEFAULT false;

ALTER TABLE call_category_contacts 
ADD COLUMN IF NOT EXISTS vacation_start DATE DEFAULT NULL;

ALTER TABLE call_category_contacts 
ADD COLUMN IF NOT EXISTS vacation_end DATE DEFAULT NULL;

ALTER TABLE call_category_contacts 
ADD COLUMN IF NOT EXISTS vacation_reason TEXT DEFAULT NULL;

-- Temporary unavailability (quick toggle by operator)
ALTER TABLE call_category_contacts 
ADD COLUMN IF NOT EXISTS currently_unavailable BOOLEAN DEFAULT false;

ALTER TABLE call_category_contacts 
ADD COLUMN IF NOT EXISTS unavailable_until TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE call_category_contacts 
ADD COLUMN IF NOT EXISTS unavailable_reason TEXT DEFAULT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_category_contacts_vacation 
ON call_category_contacts(on_vacation) WHERE on_vacation = true;

CREATE INDEX IF NOT EXISTS idx_call_category_contacts_unavailable 
ON call_category_contacts(currently_unavailable) WHERE currently_unavailable = true;

-- ============================================
-- Add availability fields to subcategory contacts
-- ============================================

ALTER TABLE call_category_subcategory_contacts 
ADD COLUMN IF NOT EXISTS available_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6];

ALTER TABLE call_category_subcategory_contacts 
ADD COLUMN IF NOT EXISTS available_hours_start TIME DEFAULT NULL;

ALTER TABLE call_category_subcategory_contacts 
ADD COLUMN IF NOT EXISTS available_hours_end TIME DEFAULT NULL;

ALTER TABLE call_category_subcategory_contacts 
ADD COLUMN IF NOT EXISTS on_vacation BOOLEAN DEFAULT false;

ALTER TABLE call_category_subcategory_contacts 
ADD COLUMN IF NOT EXISTS vacation_start DATE DEFAULT NULL;

ALTER TABLE call_category_subcategory_contacts 
ADD COLUMN IF NOT EXISTS vacation_end DATE DEFAULT NULL;

ALTER TABLE call_category_subcategory_contacts 
ADD COLUMN IF NOT EXISTS vacation_reason TEXT DEFAULT NULL;

ALTER TABLE call_category_subcategory_contacts 
ADD COLUMN IF NOT EXISTS currently_unavailable BOOLEAN DEFAULT false;

ALTER TABLE call_category_subcategory_contacts 
ADD COLUMN IF NOT EXISTS unavailable_until TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE call_category_subcategory_contacts 
ADD COLUMN IF NOT EXISTS unavailable_reason TEXT DEFAULT NULL;

-- ============================================
-- Function: Check if contact is available at specific time
-- ============================================
CREATE OR REPLACE FUNCTION is_contact_available(
  p_available_days INTEGER[],
  p_available_hours_start TIME,
  p_available_hours_end TIME,
  p_on_vacation BOOLEAN,
  p_vacation_start DATE,
  p_vacation_end DATE,
  p_currently_unavailable BOOLEAN,
  p_unavailable_until TIMESTAMPTZ,
  p_check_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN AS $$
DECLARE
  v_day_of_week INTEGER;
  v_current_time TIME;
  v_current_date DATE;
BEGIN
  -- Extract day of week (0=Sunday, 6=Saturday)
  v_day_of_week := EXTRACT(DOW FROM p_check_time);
  v_current_time := p_check_time::TIME;
  v_current_date := p_check_time::DATE;
  
  -- Check if currently marked as unavailable
  IF p_currently_unavailable THEN
    IF p_unavailable_until IS NULL OR p_unavailable_until > p_check_time THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  -- Check if on vacation
  IF p_on_vacation THEN
    IF p_vacation_start IS NOT NULL AND p_vacation_end IS NOT NULL THEN
      IF v_current_date BETWEEN p_vacation_start AND p_vacation_end THEN
        RETURN FALSE;
      END IF;
    ELSE
      RETURN FALSE; -- If on_vacation is true but no dates, assume unavailable
    END IF;
  END IF;
  
  -- Check day of week
  IF p_available_days IS NOT NULL AND array_length(p_available_days, 1) > 0 THEN
    IF NOT (v_day_of_week = ANY(p_available_days)) THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  -- Check time range
  IF p_available_hours_start IS NOT NULL AND p_available_hours_end IS NOT NULL THEN
    -- Handle cases where end time is before start time (overnight shift)
    IF p_available_hours_end < p_available_hours_start THEN
      IF NOT (v_current_time >= p_available_hours_start OR v_current_time <= p_available_hours_end) THEN
        RETURN FALSE;
      END IF;
    ELSE
      IF NOT (v_current_time BETWEEN p_available_hours_start AND p_available_hours_end) THEN
        RETURN FALSE;
      END IF;
    END IF;
  END IF;
  
  -- If all checks passed, contact is available
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Comments
-- ============================================
COMMENT ON COLUMN call_category_contacts.available_days IS 'Days of week when contact is available (0=Sunday, 6=Saturday)';
COMMENT ON COLUMN call_category_contacts.available_hours_start IS 'Start time of availability (NULL = available all day)';
COMMENT ON COLUMN call_category_contacts.available_hours_end IS 'End time of availability (NULL = available all day)';
COMMENT ON COLUMN call_category_contacts.on_vacation IS 'Is contact currently on vacation/leave';
COMMENT ON COLUMN call_category_contacts.vacation_start IS 'Vacation start date';
COMMENT ON COLUMN call_category_contacts.vacation_end IS 'Vacation end date';
COMMENT ON COLUMN call_category_contacts.currently_unavailable IS 'Temporarily marked as unavailable by operator';
COMMENT ON COLUMN call_category_contacts.unavailable_until IS 'Unavailable until this timestamp (NULL = indefinite)';

COMMENT ON FUNCTION is_contact_available IS 'Check if a contact is available at a specific time based on schedule, vacation, and unavailability status';
