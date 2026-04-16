-- Add field status to event_participants table (allow NULL for new users)
ALTER TABLE event_participants 
ADD COLUMN IF NOT EXISTS field_status VARCHAR(20) DEFAULT NULL;

-- Add check constraint
ALTER TABLE event_participants
ADD CONSTRAINT event_participants_field_status_check
CHECK (field_status IS NULL OR field_status IN ('ready', 'on_way', 'arrived', 'working', 'done', 'returned'));

-- Add timestamp for status updates
ALTER TABLE event_participants 
ADD COLUMN IF NOT EXISTS field_status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_event_participants_field_status 
ON event_participants(event_id, field_status);

-- OPTIONAL: Update existing participants to have 'ready' status
-- This is only for participants that existed before this feature
-- New participants will have NULL and must choose their status
-- UPDATE event_participants 
-- SET field_status = 'ready', field_status_updated_at = NOW() 
-- WHERE field_status IS NULL;
