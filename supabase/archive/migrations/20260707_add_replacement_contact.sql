-- Add replacement contact for vacation periods
-- When a contact is on vacation, another contact can be assigned to replace them

ALTER TABLE call_category_contacts
ADD COLUMN IF NOT EXISTS replacement_contact_id UUID DEFAULT NULL,
ADD CONSTRAINT fk_replacement_contact 
  FOREIGN KEY (replacement_contact_id) 
  REFERENCES on_call_contacts(id) 
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_replacement_contact 
ON call_category_contacts(replacement_contact_id) 
WHERE replacement_contact_id IS NOT NULL;

COMMENT ON COLUMN call_category_contacts.replacement_contact_id IS 
  'ID of contact replacing this one during vacation (references on_call_contacts)';
