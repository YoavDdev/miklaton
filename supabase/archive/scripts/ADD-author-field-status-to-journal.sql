-- Add author_field_status to event_journal to store historical status
ALTER TABLE event_journal
ADD COLUMN IF NOT EXISTS author_field_status VARCHAR(20);

-- Add check constraint for valid statuses
ALTER TABLE event_journal
ADD CONSTRAINT event_journal_author_field_status_check
CHECK (author_field_status IS NULL OR author_field_status IN ('ready', 'on_way', 'arrived', 'working', 'done', 'returned'));

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_event_journal_author_status
ON event_journal(event_id, author_field_status) WHERE author_field_status IS NOT NULL;
