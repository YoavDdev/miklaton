-- Remove the unique constraint on (call_category_id, escalation_order)
-- This allows multiple contacts with same escalation order (different time slots)

ALTER TABLE call_category_contacts
DROP CONSTRAINT IF EXISTS call_category_contacts_call_category_id_escalation_order_key;

-- Add a unique constraint that includes contact_id or external_name
-- to allow same escalation_order but different contacts
-- Actually, we don't want any unique constraint here - manager decides order

-- Just ensure no duplicates of exact same contact in same category
-- But allow same escalation_order for different contacts

SELECT 'Constraint removed successfully' as result;
