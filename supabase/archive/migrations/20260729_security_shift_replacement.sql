-- ============================================
-- Security Shift Replacement support
-- Allows swapping the assigned staff member on a shift
-- (e.g. "Moshe took my shift"), while remembering the original
-- so the change can be restored.
-- ============================================

ALTER TABLE security_daily_order_entries
  ADD COLUMN IF NOT EXISTS original_staff_name TEXT,
  ADD COLUMN IF NOT EXISTS original_staff_id UUID;
