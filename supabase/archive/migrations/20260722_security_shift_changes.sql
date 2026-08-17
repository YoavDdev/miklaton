-- ============================================
-- Security Shift Changes - Audit Log
-- Tracks all changes made to security shifts from the screen
-- ============================================

CREATE TABLE IF NOT EXISTS security_shift_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id UUID NOT NULL,  -- references security_daily_order_entries.id
  order_id UUID NOT NULL,  -- references security_daily_orders.id
  staff_id UUID,
  staff_name VARCHAR(100),
  
  -- Change details
  change_type VARCHAR(50) NOT NULL, -- 'end_time_change', 'time_change', 'removed', 'restored'
  
  -- Original values (before change)
  original_start_time VARCHAR(10),
  original_end_time VARCHAR(10),
  
  -- New values (after change)
  new_start_time VARCHAR(10),
  new_end_time VARCHAR(10),
  
  -- Audit info
  reason TEXT,                         -- why the change was made
  requested_by VARCHAR(100) DEFAULT 'מחלקת ביטחון',  -- who requested it
  changed_by VARCHAR(100) DEFAULT 'מוקד עירוני',     -- who made the change
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shift_changes_entry_id ON security_shift_changes(entry_id);
CREATE INDEX IF NOT EXISTS idx_shift_changes_order_id ON security_shift_changes(order_id);
CREATE INDEX IF NOT EXISTS idx_shift_changes_created_at ON security_shift_changes(created_at DESC);

-- RLS
ALTER TABLE security_shift_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on security_shift_changes" ON security_shift_changes
  FOR ALL USING (true) WITH CHECK (true);

-- Add columns to security_daily_order_entries for tracking modifications
ALTER TABLE security_daily_order_entries 
  ADD COLUMN IF NOT EXISTS is_removed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_modified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_start_time VARCHAR(10),
  ADD COLUMN IF NOT EXISTS original_end_time VARCHAR(10),
  ADD COLUMN IF NOT EXISTS modification_note TEXT;
