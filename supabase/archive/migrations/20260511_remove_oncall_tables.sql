-- Migration: Remove On-Call Tables
-- Description: Remove on_call_contacts and on_call_shifts tables (replaced by call_categories system)
-- Date: 2026-05-11

-- Drop function that uses these tables
DROP FUNCTION IF EXISTS get_current_on_call(UUID, TIMESTAMPTZ);

-- Drop triggers
DROP TRIGGER IF EXISTS set_on_call_contacts_updated_at ON on_call_contacts;
DROP TRIGGER IF EXISTS set_on_call_shifts_updated_at ON on_call_shifts;

-- Drop indexes
DROP INDEX IF EXISTS idx_on_call_contacts_dept;
DROP INDEX IF EXISTS idx_on_call_contacts_active;
DROP INDEX IF EXISTS idx_on_call_contacts_default;
DROP INDEX IF EXISTS idx_on_call_shifts_contact;
DROP INDEX IF EXISTS idx_on_call_shifts_dept;
DROP INDEX IF EXISTS idx_on_call_shifts_dates;

-- Drop tables (shifts first because it references contacts)
DROP TABLE IF EXISTS on_call_shifts CASCADE;
DROP TABLE IF EXISTS on_call_contacts CASCADE;

-- Note: We keep municipalities, daily_updates, and operator_tasks tables
-- as they are still in use by the system
