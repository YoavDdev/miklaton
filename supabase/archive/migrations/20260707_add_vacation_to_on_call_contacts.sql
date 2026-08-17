-- Add vacation fields to on_call_contacts table
-- This allows recording vacations for contacts not tied to any category

ALTER TABLE on_call_contacts
ADD COLUMN IF NOT EXISTS on_vacation BOOLEAN DEFAULT false;

ALTER TABLE on_call_contacts
ADD COLUMN IF NOT EXISTS vacation_start DATE DEFAULT NULL;

ALTER TABLE on_call_contacts
ADD COLUMN IF NOT EXISTS vacation_end DATE DEFAULT NULL;

ALTER TABLE on_call_contacts
ADD COLUMN IF NOT EXISTS vacation_reason TEXT DEFAULT NULL;

ALTER TABLE on_call_contacts
ADD COLUMN IF NOT EXISTS replacement_contact_id UUID REFERENCES on_call_contacts(id) ON DELETE SET NULL;
