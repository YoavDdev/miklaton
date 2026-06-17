-- Migration: Priority-based contact system
-- Description: Add priority and contact type for smart escalation
-- Date: 2026-05-11

-- Add new columns to call_category_contacts
ALTER TABLE call_category_contacts 
ADD COLUMN IF NOT EXISTS contact_type TEXT DEFAULT 'escalation' CHECK (contact_type IN ('escalation', 'notification')),
ADD COLUMN IF NOT EXISTS priority_order INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS notes_for_operator TEXT;

-- Update existing contacts to have proper priority
-- This will be set manually by the manager

-- Add comments
COMMENT ON COLUMN call_category_contacts.contact_type IS 'escalation = להקפצה, notification = לעדכון בלבד';
COMMENT ON COLUMN call_category_contacts.priority_order IS 'Priority within the same time slot (1 = first, 2 = second, etc.)';
COMMENT ON COLUMN call_category_contacts.notes_for_operator IS 'Special notes for the operator (e.g., "Only for 3+ lights", "In case of danger")';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_call_category_contacts_priority ON call_category_contacts(priority_order);
CREATE INDEX IF NOT EXISTS idx_call_category_contacts_type ON call_category_contacts(contact_type);
