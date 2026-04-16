-- Add field_status column to event_journal table for status updates
ALTER TABLE event_journal
ADD COLUMN IF NOT EXISTS field_status VARCHAR(20);

-- Add check constraint for valid statuses
ALTER TABLE event_journal
ADD CONSTRAINT event_journal_field_status_check
CHECK (field_status IS NULL OR field_status IN ('ready', 'on_way', 'arrived', 'working', 'done', 'returned'));

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_event_journal_field_status
ON event_journal(event_id, field_status) WHERE field_status IS NOT NULL;
