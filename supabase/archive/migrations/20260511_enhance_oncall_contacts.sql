-- ============================================
-- Migration: Enhance On-Call Contacts System
-- Date: 2026-05-11
-- Description: Add fields for role description, priority, escalation, and notes
-- ============================================

-- Add new columns to on_call_contacts table
DO $$ 
BEGIN
  -- Add role_description
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'on_call_contacts' AND column_name = 'role_description'
  ) THEN
    ALTER TABLE on_call_contacts ADD COLUMN role_description TEXT;
    COMMENT ON COLUMN on_call_contacts.role_description IS 'תיאור תפקיד הכונן - למשל "כונן ראשון לטיפול בתקלות"';
  END IF;

  -- Add priority
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'on_call_contacts' AND column_name = 'priority'
  ) THEN
    ALTER TABLE on_call_contacts ADD COLUMN priority INTEGER DEFAULT 1;
    COMMENT ON COLUMN on_call_contacts.priority IS 'סדר עדיפות - 1 = ראשון, 2 = שני, וכו';
  END IF;

  -- Add escalation_instructions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'on_call_contacts' AND column_name = 'escalation_instructions'
  ) THEN
    ALTER TABLE on_call_contacts ADD COLUMN escalation_instructions TEXT;
    COMMENT ON COLUMN on_call_contacts.escalation_instructions IS 'הוראות הקפצה - מה לעשות אם הכונן לא זמין';
  END IF;

  -- Add fallback_contact_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'on_call_contacts' AND column_name = 'fallback_contact_id'
  ) THEN
    ALTER TABLE on_call_contacts ADD COLUMN fallback_contact_id UUID REFERENCES on_call_contacts(id) ON DELETE SET NULL;
    COMMENT ON COLUMN on_call_contacts.fallback_contact_id IS 'כונן גיבוי - אליו להתקשר אם הכונן הראשי לא זמין';
  END IF;

  -- Add notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'on_call_contacts' AND column_name = 'notes'
  ) THEN
    ALTER TABLE on_call_contacts ADD COLUMN notes TEXT;
    COMMENT ON COLUMN on_call_contacts.notes IS 'הערות והדרכות כלליות';
  END IF;

  -- Add available_hours
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'on_call_contacts' AND column_name = 'available_hours'
  ) THEN
    ALTER TABLE on_call_contacts ADD COLUMN available_hours VARCHAR(50) DEFAULT '24/7';
    COMMENT ON COLUMN on_call_contacts.available_hours IS 'שעות זמינות - למשל "24/7" או "08:00-17:00"';
  END IF;

END $$;

-- Add index on priority for faster sorting
CREATE INDEX IF NOT EXISTS idx_on_call_contacts_priority 
  ON on_call_contacts(department_id, priority, active);

-- Create helper function to get on-call contact with fallback
CREATE OR REPLACE FUNCTION get_on_call_with_fallback(
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
  external_company VARCHAR(100)
) AS $$
BEGIN
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
    oc.external_company
  FROM on_call_contacts oc
  LEFT JOIN on_call_contacts fb ON fb.id = oc.fallback_contact_id
  WHERE oc.department_id = p_department_id
    AND oc.active = true
    AND EXISTS (
      SELECT 1 FROM on_call_shifts os
      WHERE os.contact_id = oc.id
        AND os.department_id = p_department_id
        AND (os.start_date IS NULL OR os.start_date <= p_check_time::DATE)
        AND (os.end_date IS NULL OR os.end_date >= p_check_time::DATE)
    )
  ORDER BY oc.priority ASC, oc.created_at ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_on_call_with_fallback IS 'מחזיר את הכונן הפעיל כרגע למחלקה, כולל פרטי גיבוי';

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_on_call_with_fallback TO authenticated;
