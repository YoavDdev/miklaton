-- ============================================
-- Free-text replacement note for vacations
-- Lets the call-center manager write who is covering
-- for a person on vacation (plain text, not a contact link).
-- ============================================

ALTER TABLE call_category_contacts
  ADD COLUMN IF NOT EXISTS replacement_note TEXT;

ALTER TABLE on_call_contacts
  ADD COLUMN IF NOT EXISTS replacement_note TEXT;
